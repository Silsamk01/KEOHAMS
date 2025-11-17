<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Update orders status enum - Laravel doesn't support enum changes easily, use raw SQL
        DB::statement("ALTER TABLE orders MODIFY COLUMN status ENUM(
            'PENDING',
            'AWAITING_PAYMENT',
            'PAYMENT_FAILED',
            'PAID',
            'PROCESSING',
            'AWAITING_SHIPMENT',
            'SHIPPED',
            'IN_TRANSIT',
            'OUT_FOR_DELIVERY',
            'DELIVERED',
            'CANCELLED',
            'REFUNDED',
            'ON_HOLD',
            'PARTIALLY_SHIPPED'
        ) DEFAULT 'PENDING'");

        // Add shipping and tracking fields to orders
        Schema::table('orders', function (Blueprint $table) {
            $table->json('shipping_address')->nullable()->after('total_amount');
            $table->json('billing_address')->nullable()->after('shipping_address');
            $table->string('shipping_method', 100)->nullable()->after('billing_address');
            $table->decimal('shipping_cost', 12, 2)->default(0)->after('shipping_method');
            $table->string('tracking_number', 100)->nullable()->after('shipping_cost');
            $table->string('carrier', 100)->nullable()->after('tracking_number');
            $table->string('estimated_delivery_date', 50)->nullable()->after('carrier');
            $table->timestamp('shipped_at')->nullable()->after('estimated_delivery_date');
            $table->timestamp('delivered_at')->nullable()->after('shipped_at');
            $table->text('cancellation_reason')->nullable()->after('delivered_at');
            $table->timestamp('cancelled_at')->nullable()->after('cancellation_reason');
            $table->unsignedBigInteger('cancelled_by')->nullable()->after('cancelled_at');
            $table->foreign('cancelled_by')->references('id')->on('users')->onDelete('set null');
            $table->text('admin_notes')->nullable()->after('cancelled_by');
            $table->text('customer_notes')->nullable()->after('admin_notes');
        });

        // Order Status History
        Schema::create('order_status_history', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('order_id');
            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
            $table->string('from_status', 50)->nullable();
            $table->string('to_status', 50);
            $table->unsignedBigInteger('changed_by')->nullable();
            $table->foreign('changed_by')->references('id')->on('users')->onDelete('set null');
            $table->enum('changed_by_type', ['CUSTOMER', 'ADMIN', 'SYSTEM'])->default('SYSTEM');
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            
            $table->index('order_id');
            $table->index('to_status');
            $table->index('created_at');
        });

        // Order Shipments
        Schema::create('order_shipments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('order_id');
            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
            $table->string('shipment_reference', 100)->unique();
            $table->enum('status', ['PREPARING', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED'])->default('PREPARING');
            $table->string('tracking_number', 100)->nullable();
            $table->string('carrier', 100)->nullable();
            $table->decimal('weight', 10, 2)->nullable();
            $table->json('dimensions')->nullable();
            $table->json('items');
            $table->timestamp('shipped_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            
            $table->index('order_id');
            $table->index('status');
            $table->index('tracking_number');
        });

        // Order Returns
        Schema::create('order_returns', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('order_id');
            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
            $table->unsignedBigInteger('user_id');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->string('return_reference', 100)->unique();
            $table->enum('type', ['RETURN', 'EXCHANGE', 'REFUND']);
            $table->enum('reason', ['DEFECTIVE', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'DAMAGED_IN_SHIPPING', 'CHANGED_MIND', 'LATE_DELIVERY', 'OTHER']);
            $table->text('description');
            $table->json('items');
            $table->enum('status', ['REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'INSPECTING', 'COMPLETED', 'CANCELLED'])->default('REQUESTED');
            $table->decimal('refund_amount', 12, 2)->default(0);
            $table->json('images')->nullable();
            $table->text('admin_notes')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->unsignedBigInteger('processed_by')->nullable();
            $table->foreign('processed_by')->references('id')->on('users')->onDelete('set null');
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            
            $table->index('order_id');
            $table->index('user_id');
            $table->index('status');
            $table->index('type');
        });

        // Order Invoices
        Schema::create('order_invoices', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('order_id');
            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
            $table->string('invoice_number', 100)->unique();
            $table->enum('type', ['INVOICE', 'RECEIPT', 'CREDIT_NOTE'])->default('INVOICE');
            $table->decimal('subtotal', 12, 2);
            $table->decimal('tax', 12, 2)->default(0);
            $table->decimal('shipping', 12, 2)->default(0);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('total', 12, 2);
            $table->string('currency', 3)->default('NGN');
            $table->json('items');
            $table->string('pdf_url', 500)->nullable();
            $table->enum('status', ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'])->default('DRAFT');
            $table->timestamp('due_date')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
            
            $table->index('order_id');
            $table->index('invoice_number');
            $table->index('status');
        });

        // Order Notes
        Schema::create('order_notes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('order_id');
            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
            $table->unsignedBigInteger('created_by');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
            $table->text('note');
            $table->boolean('customer_visible')->default(false);
            $table->timestamps();
            
            $table->index('order_id');
            $table->index('created_by');
        });

        // Add fulfillment fields to order_items
        Schema::table('order_items', function (Blueprint $table) {
            $table->integer('quantity_shipped')->default(0)->after('quantity');
            $table->integer('quantity_cancelled')->default(0)->after('quantity_shipped');
            $table->integer('quantity_returned')->default(0)->after('quantity_cancelled');
            $table->enum('fulfillment_status', ['PENDING', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED'])->default('PENDING')->after('quantity_returned');
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn(['quantity_shipped', 'quantity_cancelled', 'quantity_returned', 'fulfillment_status']);
        });

        Schema::dropIfExists('order_notes');
        Schema::dropIfExists('order_invoices');
        Schema::dropIfExists('order_returns');
        Schema::dropIfExists('order_shipments');
        Schema::dropIfExists('order_status_history');

        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['cancelled_by']);
            $table->dropColumn([
                'shipping_address', 'billing_address', 'shipping_method', 'shipping_cost',
                'tracking_number', 'carrier', 'estimated_delivery_date', 'shipped_at',
                'delivered_at', 'cancellation_reason', 'cancelled_at', 'cancelled_by',
                'admin_notes', 'customer_notes'
            ]);
        });

        DB::statement("ALTER TABLE orders MODIFY COLUMN status VARCHAR(255) DEFAULT 'PENDING'");
    }
};
