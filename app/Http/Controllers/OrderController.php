<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ActivityLog;
use App\Mail\OrderConfirmationEmail;
use App\Mail\OrderStatusEmail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class OrderController extends Controller
{
    /**
     * Get all orders for authenticated user
     */
    public function index(Request $request)
    {
        $query = Order::with(['items.product', 'paymentTransaction'])
            ->byUser($request->user()->id);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $orders = $query->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($orders);
    }

    /**
     * Get single order
     */
    public function show(Request $request, $id)
    {
        $order = Order::with([
            'items.product',
            'paymentTransaction',
            'statusHistory',
            'shipments',
            'notes'
        ])->findOrFail($id);

        // Ensure user owns the order or is admin
        if ($order->user_id !== $request->user()->id && $request->user()->role !== 'ADMIN') {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        return response()->json($order);
    }

    /**
     * Create new order
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'shipping_address' => 'required|array',
            'billing_address' => 'required|array',
            'shipping_method' => 'required|string',
            'payment_method' => 'required|in:PAYSTACK,BANK_TRANSFER,CARD',
        ]);

        DB::beginTransaction();

        try {
            // Create order
            $order = Order::create([
                'user_id' => $request->user()->id,
                'order_number' => Order::generateOrderNumber(),
                'status' => 'PENDING',
                'payment_status' => 'PENDING',
                'payment_method' => $validated['payment_method'],
                'shipping_method' => $validated['shipping_method'],
                'shipping_address' => $validated['shipping_address'],
                'billing_address' => $validated['billing_address'],
            ]);

            $subtotal = 0;

            // Create order items
            foreach ($validated['items'] as $item) {
                $product = Product::findOrFail($item['product_id']);

                // Check MOQ
                if ($item['quantity'] < $product->moq) {
                    throw new \Exception("Product {$product->name} has minimum order quantity of {$product->moq}");
                }

                // Check stock
                if ($item['quantity'] > $product->stock_quantity) {
                    throw new \Exception("Insufficient stock for product {$product->name}");
                }

                // Calculate price (check bulk discounts)
                $unitPrice = $product->price_per_unit;
                $bulkDiscount = $product->bulkDiscounts()
                    ->where('min_quantity', '<=', $item['quantity'])
                    ->orderBy('min_quantity', 'desc')
                    ->first();

                if ($bulkDiscount) {
                    $unitPrice = $bulkDiscount->discounted_price;
                }

                $itemTotal = $unitPrice * $item['quantity'];
                $subtotal += $itemTotal;

                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_sku' => $product->sku,
                    'quantity' => $item['quantity'],
                    'unit_price' => $unitPrice,
                    'subtotal' => $itemTotal,
                ]);

                // Decrement stock
                $product->decrementStock($item['quantity']);
            }

            // Calculate totals
            $order->calculateTotals();

            DB::commit();

            ActivityLog::log('ORDER_CREATED', $request->user()->id, 'Order created', [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'total' => $order->total_amount,
            ]);

            return response()->json([
                'message' => 'Order created successfully.',
                'order' => $order->load(['items.product'])
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    /**
     * Cancel order
     */
    public function cancel(Request $request, $id)
    {
        $order = Order::findOrFail($id);

        // Check if user owns order or is admin
        if ($order->user_id !== $request->user()->id && $request->user()->role !== 'ADMIN') {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (!$order->can_be_cancelled) {
            return response()->json(['message' => 'Order cannot be cancelled.'], 400);
        }

        $validated = $request->validate([
            'reason' => 'nullable|string',
        ]);

        $order->cancel($request->user()->id, $validated['reason'] ?? null);

        ActivityLog::log('ORDER_CANCELLED', $request->user()->id, 'Order cancelled', [
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'reason' => $validated['reason'] ?? null,
        ]);

        return response()->json([
            'message' => 'Order cancelled successfully.',
            'order' => $order
        ]);
    }

    /**
     * Update order status (Admin only)
     */
    public function updateStatus(Request $request, $id)
    {
        $validated = $request->validate([
            'status' => 'required|in:PENDING,CONFIRMED,PROCESSING,SHIPPED,DELIVERED,CANCELLED,REFUNDED,FAILED,ON_HOLD,AWAITING_PAYMENT,AWAITING_FULFILLMENT,PARTIALLY_SHIPPED,RETURNED,COMPLETED',
            'notes' => 'nullable|string',
        ]);

        $order = Order::findOrFail($id);

        $order->updateStatus($validated['status'], $request->user()->id, $validated['notes'] ?? null);

        ActivityLog::log('ORDER_STATUS_UPDATED', $request->user()->id, 'Order status updated', [
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'status' => $validated['status'],
        ]);

        // Send status update email
        Mail::to($order->user->email)->queue(new OrderStatusEmail($order, $validated['status']));

        return response()->json([
            'message' => 'Order status updated successfully.',
            'order' => $order
        ]);
    }

    /**
     * Mark order as shipped (Admin only)
     */
    public function ship(Request $request, $id)
    {
        $validated = $request->validate([
            'tracking_number' => 'required|string',
            'carrier' => 'required|string',
            'notes' => 'nullable|string',
        ]);

        $order = Order::findOrFail($id);

        $order->ship(
            $validated['tracking_number'],
            $validated['carrier'],
            $request->user()->id,
            $validated['notes'] ?? null
        );

        ActivityLog::log('ORDER_SHIPPED', $request->user()->id, 'Order shipped', [
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'tracking_number' => $validated['tracking_number'],
        ]);

        // Send shipping notification email
        Mail::to($order->user->email)->queue(new OrderStatusEmail($order, 'SHIPPED', $validated['tracking_number']));

        return response()->json([
            'message' => 'Order marked as shipped.',
            'order' => $order
        ]);
    }

    /**
     * Mark order as delivered (Admin only)
     */
    public function deliver(Request $request, $id)
    {
        $validated = $request->validate([
            'notes' => 'nullable|string',
        ]);

        $order = Order::findOrFail($id);

        $order->deliver($request->user()->id, $validated['notes'] ?? null);

        ActivityLog::log('ORDER_DELIVERED', $request->user()->id, 'Order delivered', [
            'order_id' => $order->id,
            'order_number' => $order->order_number,
        ]);

        // Send delivery confirmation email
        Mail::to($order->user->email)->queue(new OrderStatusEmail($order, 'DELIVERED'));

        return response()->json([
            'message' => 'Order marked as delivered.',
            'order' => $order
        ]);
    }

    /**
     * Get all orders (Admin only)
     */
    public function adminIndex(Request $request)
    {
        $query = Order::with(['user', 'items.product', 'paymentTransaction']);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by payment status
        if ($request->has('payment_status')) {
            $query->where('payment_status', $request->payment_status);
        }

        // Search by order number or customer name
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('order_number', 'LIKE', "%{$search}%")
                  ->orWhereHas('user', function($q2) use ($search) {
                      $q2->where('first_name', 'LIKE', "%{$search}%")
                         ->orWhere('last_name', 'LIKE', "%{$search}%")
                         ->orWhere('email', 'LIKE', "%{$search}%");
                  });
            });
        }

        $orders = $query->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($orders);
    }
}
