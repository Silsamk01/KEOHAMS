<?php

namespace App\Http\Controllers;

use App\Models\Quotation;
use App\Models\QuotationItem;
use App\Models\Product;
use App\Models\ActivityLog;
use App\Mail\QuotationRepliedEmail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class QuotationController extends Controller
{
    /**
     * Get all quotations for authenticated user
     */
    public function index(Request $request)
    {
        $query = Quotation::with(['items.product'])
            ->byUser($request->user()->id);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $quotations = $query->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($quotations);
    }

    /**
     * Get single quotation
     */
    public function show(Request $request, $id)
    {
        $quotation = Quotation::with(['items.product', 'paymentTransaction'])
            ->findOrFail($id);

        // Ensure user owns the quotation or is admin
        if ($quotation->user_id !== $request->user()->id && $request->user()->role !== 'ADMIN') {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        return response()->json($quotation);
    }

    /**
     * Request quotation
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.notes' => 'nullable|string',
            'shipping_address' => 'required|array',
            'delivery_timeline' => 'nullable|string',
            'special_requests' => 'nullable|string',
        ]);

        DB::beginTransaction();

        try {
            // Create quotation
            $quotation = Quotation::create([
                'user_id' => $request->user()->id,
                'quotation_reference' => Quotation::generateReference(),
                'status' => 'REQUESTED',
                'shipping_address' => $validated['shipping_address'],
                'delivery_timeline' => $validated['delivery_timeline'] ?? null,
                'special_requests' => $validated['special_requests'] ?? null,
            ]);

            // Create quotation items
            foreach ($validated['items'] as $item) {
                $product = Product::findOrFail($item['product_id']);

                QuotationItem::create([
                    'quotation_id' => $quotation->id,
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_sku' => $product->sku,
                    'requested_quantity' => $item['quantity'],
                    'notes' => $item['notes'] ?? null,
                ]);
            }

            DB::commit();

            ActivityLog::log('QUOTATION_REQUESTED', $request->user()->id, 'Quotation requested', [
                'quotation_id' => $quotation->id,
                'reference' => $quotation->quotation_reference,
            ]);

            return response()->json([
                'message' => 'Quotation requested successfully. We will review and respond soon.',
                'quotation' => $quotation->load(['items.product'])
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    /**
     * Reply to quotation (Admin only)
     */
    public function reply(Request $request, $id)
    {
        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.quotation_item_id' => 'required|exists:quotation_items,id',
            'items.*.quoted_quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.notes' => 'nullable|string',
            'subtotal_amount' => 'required|numeric|min:0',
            'logistics_amount' => 'required|numeric|min:0',
            'discount_amount' => 'nullable|numeric|min:0',
            'total_amount' => 'required|numeric|min:0',
            'validity_period_days' => 'required|integer|min:1',
            'payment_terms' => 'nullable|string',
            'delivery_terms' => 'nullable|string',
            'allowed_payment_methods' => 'nullable|string',
            'admin_notes' => 'nullable|string',
        ]);

        $quotation = Quotation::findOrFail($id);

        if ($quotation->status !== 'REQUESTED') {
            return response()->json(['message' => 'Quotation has already been replied to.'], 400);
        }

        DB::beginTransaction();

        try {
            // Update quotation items
            foreach ($validated['items'] as $item) {
                $quotationItem = QuotationItem::findOrFail($item['quotation_item_id']);

                if ($quotationItem->quotation_id !== $quotation->id) {
                    throw new \Exception('Invalid quotation item.');
                }

                $quotationItem->update([
                    'quoted_quantity' => $item['quoted_quantity'],
                    'unit_price' => $item['unit_price'],
                    'subtotal' => $item['quoted_quantity'] * $item['unit_price'],
                    'admin_notes' => $item['notes'] ?? null,
                ]);
            }

            // Update quotation
            $quotation->update([
                'status' => 'REPLIED',
                'subtotal_amount' => $validated['subtotal_amount'],
                'logistics_amount' => $validated['logistics_amount'],
                'discount_amount' => $validated['discount_amount'] ?? 0,
                'total_amount' => $validated['total_amount'],
                'validity_period_days' => $validated['validity_period_days'],
                'payment_terms' => $validated['payment_terms'] ?? null,
                'delivery_terms' => $validated['delivery_terms'] ?? null,
                'allowed_payment_methods' => $validated['allowed_payment_methods'] ?? null,
                'admin_notes' => $validated['admin_notes'] ?? null,
                'replied_at' => now(),
                'replied_by' => $request->user()->id,
                'valid_until' => now()->addDays($validated['validity_period_days']),
            ]);

            DB::commit();

            ActivityLog::log('QUOTATION_REPLIED', $request->user()->id, 'Quotation replied', [
                'quotation_id' => $quotation->id,
                'reference' => $quotation->quotation_reference,
                'total_amount' => $quotation->total_amount,
            ]);

            // Send quotation reply email (queued)
            Mail::to($quotation->user->email)->queue(new QuotationRepliedEmail($quotation));

            return response()->json([
                'message' => 'Quotation replied successfully.',
                'quotation' => $quotation->load(['items.product'])
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    /**
     * Cancel quotation
     */
    public function cancel(Request $request, $id)
    {
        $quotation = Quotation::findOrFail($id);

        // Check if user owns quotation or is admin
        if ($quotation->user_id !== $request->user()->id && $request->user()->role !== 'ADMIN') {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if ($quotation->status === 'PAID') {
            return response()->json(['message' => 'Cannot cancel paid quotation.'], 400);
        }

        $validated = $request->validate([
            'reason' => 'nullable|string',
        ]);

        $quotation->cancel($validated['reason'] ?? null);

        ActivityLog::log('QUOTATION_CANCELLED', $request->user()->id, 'Quotation cancelled', [
            'quotation_id' => $quotation->id,
            'reference' => $quotation->quotation_reference,
            'reason' => $validated['reason'] ?? null,
        ]);

        return response()->json([
            'message' => 'Quotation cancelled successfully.',
            'quotation' => $quotation
        ]);
    }

    /**
     * Get all quotations (Admin only)
     */
    public function adminIndex(Request $request)
    {
        $query = Quotation::with(['user', 'items.product']);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Search by reference or customer name
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('quotation_reference', 'LIKE', "%{$search}%")
                  ->orWhereHas('user', function($q2) use ($search) {
                      $q2->where('first_name', 'LIKE', "%{$search}%")
                         ->orWhere('last_name', 'LIKE', "%{$search}%")
                         ->orWhere('email', 'LIKE', "%{$search}%");
                  });
            });
        }

        $quotations = $query->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($quotations);
    }
}
