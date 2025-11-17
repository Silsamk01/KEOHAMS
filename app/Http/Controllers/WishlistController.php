<?php

namespace App\Http\Controllers;

use App\Models\Wishlist;
use App\Models\WishlistItem;
use App\Models\Product;
use App\Models\ActivityLog;
use Illuminate\Http\Request;

class WishlistController extends Controller
{
    /**
     * Get user's wishlist
     */
    public function index(Request $request)
    {
        $wishlist = Wishlist::with(['items.product'])
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$wishlist) {
            // Create wishlist if doesn't exist
            $wishlist = Wishlist::create([
                'user_id' => $request->user()->id,
                'name' => 'My Wishlist',
            ]);
        }

        return response()->json($wishlist);
    }

    /**
     * Add item to wishlist
     */
    public function addItem(Request $request)
    {
        $validated = $request->validate([
            'product_id' => 'required|exists:products,id',
            'desired_quantity' => 'nullable|integer|min:1',
            'notes' => 'nullable|string',
        ]);

        $userId = $request->user()->id;

        // Get or create wishlist
        $wishlist = Wishlist::firstOrCreate(
            ['user_id' => $userId],
            ['name' => 'My Wishlist']
        );

        // Check if item already in wishlist
        $existingItem = WishlistItem::where('wishlist_id', $wishlist->id)
            ->where('product_id', $validated['product_id'])
            ->first();

        if ($existingItem) {
            return response()->json(['message' => 'Item already in wishlist.'], 400);
        }

        $product = Product::findOrFail($validated['product_id']);

        $item = WishlistItem::create([
            'wishlist_id' => $wishlist->id,
            'product_id' => $validated['product_id'],
            'price_when_added' => $product->price_per_unit,
            'desired_quantity' => $validated['desired_quantity'] ?? 1,
            'notes' => $validated['notes'] ?? null,
        ]);

        ActivityLog::log('WISHLIST_ITEM_ADDED', $userId, 'Item added to wishlist', [
            'wishlist_id' => $wishlist->id,
            'product_id' => $validated['product_id'],
        ]);

        return response()->json([
            'message' => 'Item added to wishlist.',
            'item' => $item->load('product')
        ], 201);
    }

    /**
     * Remove item from wishlist
     */
    public function removeItem(Request $request, $itemId)
    {
        $item = WishlistItem::findOrFail($itemId);

        // Check if item belongs to user's wishlist
        if ($item->wishlist->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        ActivityLog::log('WISHLIST_ITEM_REMOVED', $request->user()->id, 'Item removed from wishlist', [
            'wishlist_id' => $item->wishlist_id,
            'product_id' => $item->product_id,
        ]);

        $item->delete();

        return response()->json(['message' => 'Item removed from wishlist.']);
    }

    /**
     * Update wishlist item
     */
    public function updateItem(Request $request, $itemId)
    {
        $validated = $request->validate([
            'desired_quantity' => 'sometimes|integer|min:1',
            'notes' => 'nullable|string',
        ]);

        $item = WishlistItem::findOrFail($itemId);

        // Check if item belongs to user's wishlist
        if ($item->wishlist->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $item->update($validated);

        return response()->json([
            'message' => 'Wishlist item updated.',
            'item' => $item->load('product')
        ]);
    }

    /**
     * Clear wishlist
     */
    public function clear(Request $request)
    {
        $wishlist = Wishlist::where('user_id', $request->user()->id)->first();

        if ($wishlist) {
            $wishlist->items()->delete();

            ActivityLog::log('WISHLIST_CLEARED', $request->user()->id, 'Wishlist cleared', [
                'wishlist_id' => $wishlist->id,
            ]);
        }

        return response()->json(['message' => 'Wishlist cleared.']);
    }

    /**
     * Share wishlist (make public)
     */
    public function share(Request $request)
    {
        $wishlist = Wishlist::where('user_id', $request->user()->id)->first();

        if (!$wishlist) {
            return response()->json(['message' => 'Wishlist not found.'], 404);
        }

        if (!$wishlist->share_token) {
            $wishlist->share_token = \Illuminate\Support\Str::random(32);
            $wishlist->save();
        }

        $wishlist->update(['is_private' => false]);

        ActivityLog::log('WISHLIST_SHARED', $request->user()->id, 'Wishlist shared', [
            'wishlist_id' => $wishlist->id,
        ]);

        return response()->json([
            'message' => 'Wishlist shared successfully.',
            'share_url' => config('app.url') . '/wishlist/shared/' . $wishlist->share_token
        ]);
    }

    /**
     * View shared wishlist (public)
     */
    public function viewShared($token)
    {
        $wishlist = Wishlist::with(['items.product', 'user'])
            ->where('share_token', $token)
            ->where('is_private', false)
            ->firstOrFail();

        return response()->json($wishlist);
    }

    /**
     * Make wishlist private
     */
    public function makePrivate(Request $request)
    {
        $wishlist = Wishlist::where('user_id', $request->user()->id)->first();

        if (!$wishlist) {
            return response()->json(['message' => 'Wishlist not found.'], 404);
        }

        $wishlist->update(['is_private' => true]);

        ActivityLog::log('WISHLIST_MADE_PRIVATE', $request->user()->id, 'Wishlist made private', [
            'wishlist_id' => $wishlist->id,
        ]);

        return response()->json(['message' => 'Wishlist is now private.']);
    }

    /**
     * Get item count
     */
    public function count(Request $request)
    {
        $wishlist = Wishlist::where('user_id', $request->user()->id)->first();

        $count = $wishlist ? $wishlist->items()->count() : 0;

        return response()->json(['count' => $count]);
    }
}
