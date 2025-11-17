<?php

namespace App\Http\Controllers;

use App\Models\ProductReview;
use App\Models\Product;
use App\Models\Order;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ReviewController extends Controller
{
    /**
     * Get reviews for a product
     */
    public function index($productId)
    {
        $reviews = ProductReview::with(['user', 'images'])
            ->where('product_id', $productId)
            ->approved()
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($reviews);
    }

    /**
     * Submit product review
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_id' => 'required|exists:products,id',
            'order_id' => 'nullable|exists:orders,id',
            'rating' => 'required|integer|min:1|max:5',
            'title' => 'nullable|string|max:255',
            'comment' => 'required|string',
            'images' => 'nullable|array|max:5',
            'images.*' => 'file|mimes:jpg,jpeg,png|max:2048',
        ]);

        $userId = $request->user()->id;

        // Check if user already reviewed this product
        $existingReview = ProductReview::where('user_id', $userId)
            ->where('product_id', $validated['product_id'])
            ->first();

        if ($existingReview) {
            return response()->json(['message' => 'You have already reviewed this product.'], 400);
        }

        // Check if user purchased the product
        $isVerifiedPurchase = false;
        if (!empty($validated['order_id'])) {
            $order = Order::where('id', $validated['order_id'])
                ->where('user_id', $userId)
                ->whereHas('items', function($query) use ($validated) {
                    $query->where('product_id', $validated['product_id']);
                })
                ->where('status', 'DELIVERED')
                ->first();

            if ($order) {
                $isVerifiedPurchase = true;
            }
        }

        // Create review
        $review = ProductReview::create([
            'product_id' => $validated['product_id'],
            'user_id' => $userId,
            'order_id' => $validated['order_id'] ?? null,
            'rating' => $validated['rating'],
            'title' => $validated['title'] ?? null,
            'comment' => $validated['comment'],
            'is_verified_purchase' => $isVerifiedPurchase,
            'is_approved' => false, // Requires admin approval
        ]);

        // Upload images
        if ($request->hasFile('images')) {
            foreach ($request->file('images') as $image) {
                $path = $image->store('reviews', 'public');
                
                \App\Models\ReviewImage::create([
                    'review_id' => $review->id,
                    'image_url' => $path,
                ]);
            }
        }

        ActivityLog::log('REVIEW_SUBMITTED', $userId, 'Review submitted', [
            'review_id' => $review->id,
            'product_id' => $validated['product_id'],
            'rating' => $validated['rating'],
        ]);

        return response()->json([
            'message' => 'Review submitted successfully. It will be published after approval.',
            'review' => $review->load(['images'])
        ], 201);
    }

    /**
     * Update review
     */
    public function update(Request $request, $id)
    {
        $review = ProductReview::findOrFail($id);

        if ($review->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate([
            'rating' => 'sometimes|integer|min:1|max:5',
            'title' => 'nullable|string|max:255',
            'comment' => 'sometimes|string',
        ]);

        $review->update(array_merge($validated, ['is_approved' => false]));

        ActivityLog::log('REVIEW_UPDATED', $request->user()->id, 'Review updated', [
            'review_id' => $review->id,
        ]);

        return response()->json([
            'message' => 'Review updated successfully.',
            'review' => $review
        ]);
    }

    /**
     * Delete review
     */
    public function destroy(Request $request, $id)
    {
        $review = ProductReview::findOrFail($id);

        if ($review->user_id !== $request->user()->id && $request->user()->role !== 'ADMIN') {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        ActivityLog::log('REVIEW_DELETED', $request->user()->id, 'Review deleted', [
            'review_id' => $review->id,
        ]);

        $review->delete();

        return response()->json(['message' => 'Review deleted successfully.']);
    }

    /**
     * Vote on review helpfulness
     */
    public function vote(Request $request, $id)
    {
        $validated = $request->validate([
            'is_helpful' => 'required|boolean',
        ]);

        $review = ProductReview::findOrFail($id);
        $userId = $request->user()->id;

        // Check if user already voted
        $existingVote = \App\Models\ReviewVote::where('review_id', $review->id)
            ->where('user_id', $userId)
            ->first();

        if ($existingVote) {
            // Update vote
            $existingVote->update(['is_helpful' => $validated['is_helpful']]);
        } else {
            // Create vote
            \App\Models\ReviewVote::create([
                'review_id' => $review->id,
                'user_id' => $userId,
                'is_helpful' => $validated['is_helpful'],
            ]);
        }

        // Update counts
        $review->helpful_count = $review->votes()->where('is_helpful', true)->count();
        $review->unhelpful_count = $review->votes()->where('is_helpful', false)->count();
        $review->save();

        return response()->json([
            'message' => 'Vote recorded.',
            'review' => $review
        ]);
    }

    /**
     * Get all reviews (Admin)
     */
    public function adminIndex(Request $request)
    {
        $query = ProductReview::with(['user', 'product']);

        // Filter by approval status
        if ($request->has('is_approved')) {
            $query->where('is_approved', $request->is_approved === 'true');
        }

        $reviews = $query->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($reviews);
    }

    /**
     * Approve review (Admin only)
     */
    public function approve(Request $request, $id)
    {
        $review = ProductReview::findOrFail($id);

        $review->update(['is_approved' => true]);

        ActivityLog::log('REVIEW_APPROVED', $request->user()->id, 'Review approved', [
            'review_id' => $review->id,
        ]);

        return response()->json([
            'message' => 'Review approved successfully.',
            'review' => $review
        ]);
    }

    /**
     * Reject review (Admin only)
     */
    public function reject(Request $request, $id)
    {
        $review = ProductReview::findOrFail($id);

        $review->update(['is_approved' => false]);

        ActivityLog::log('REVIEW_REJECTED', $request->user()->id, 'Review rejected', [
            'review_id' => $review->id,
        ]);

        return response()->json([
            'message' => 'Review rejected successfully.',
            'review' => $review
        ]);
    }
}
