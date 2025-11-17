<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Payment Transactions
        Schema::create('payment_transactions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->unsignedBigInteger('order_id')->nullable();
            $table->foreign('order_id')->references('id')->on('orders')->onDelete('set null');
            $table->unsignedBigInteger('quotation_id')->nullable();
            $table->foreign('quotation_id')->references('id')->on('quotations')->onDelete('set null');
            $table->string('reference', 100)->unique();
            $table->decimal('amount', 15, 2);
            $table->string('currency', 3)->default('NGN');
            $table->enum('status', ['PENDING', 'SUCCESS', 'FAILED', 'ABANDONED', 'REFUNDED', 'PARTIALLY_REFUNDED'])->default('PENDING');
            $table->enum('payment_method', ['CARD', 'BANK_TRANSFER', 'USSD', 'QR', 'MOBILE_MONEY', 'BANK_ACCOUNT'])->nullable();
            $table->string('paystack_reference', 100)->nullable();
            $table->string('authorization_code', 100)->nullable();
            $table->string('card_type', 50)->nullable();
            $table->string('card_last4', 4)->nullable();
            $table->string('bank', 100)->nullable();
            $table->string('channel', 50)->nullable();
            $table->string('customer_email', 255);
            $table->string('customer_name', 255)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->json('metadata')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();
            
            $table->index('user_id');
            $table->index('order_id');
            $table->index('quotation_id');
            $table->index('status');
        });

        // Payment Refunds
        Schema::create('payment_refunds', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('transaction_id');
            $table->foreign('transaction_id')->references('id')->on('payment_transactions')->onDelete('cascade');
            $table->unsignedBigInteger('initiated_by')->nullable();
            $table->foreign('initiated_by')->references('id')->on('users')->onDelete('set null');
            $table->string('refund_reference', 100)->unique();
            $table->decimal('amount', 15, 2);
            $table->string('currency', 3)->default('NGN');
            $table->enum('status', ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'])->default('PENDING');
            $table->enum('reason', ['CUSTOMER_REQUEST', 'DUPLICATE_PAYMENT', 'FRAUDULENT', 'ORDER_CANCELLED', 'PRODUCT_NOT_AVAILABLE', 'OTHER']);
            $table->text('notes')->nullable();
            $table->string('paystack_refund_id')->nullable();
            $table->json('paystack_response')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
            
            $table->index('transaction_id');
            $table->index('status');
        });

        // Payment Webhooks
        Schema::create('payment_webhooks', function (Blueprint $table) {
            $table->id();
            $table->string('event_type', 100);
            $table->string('reference', 100)->nullable();
            $table->json('payload');
            $table->enum('status', ['PENDING', 'PROCESSED', 'FAILED', 'IGNORED'])->default('PENDING');
            $table->text('error_message')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
            
            $table->index('event_type');
            $table->index('reference');
            $table->index('status');
        });

        // Saved Payment Methods
        Schema::create('saved_payment_methods', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->string('authorization_code', 100)->unique();
            $table->string('card_type', 50)->nullable();
            $table->string('card_last4', 4)->nullable();
            $table->string('exp_month', 2)->nullable();
            $table->string('exp_year', 4)->nullable();
            $table->string('bank', 100)->nullable();
            $table->string('card_bin', 6)->nullable();
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            $table->index('user_id');
        });

        // Add payment fields to orders
        Schema::table('orders', function (Blueprint $table) {
            $table->unsignedBigInteger('payment_transaction_id')->nullable();
            $table->foreign('payment_transaction_id')->references('id')->on('payment_transactions')->onDelete('set null');
            $table->enum('payment_status', ['UNPAID', 'PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'])->default('UNPAID');
            $table->timestamp('paid_at')->nullable();
        });

        // Add payment fields to quotations
        Schema::table('quotations', function (Blueprint $table) {
            $table->unsignedBigInteger('payment_transaction_id')->nullable();
            $table->foreign('payment_transaction_id')->references('id')->on('payment_transactions')->onDelete('set null');
            $table->enum('payment_status', ['UNPAID', 'PENDING', 'PAID', 'FAILED', 'REFUNDED'])->default('UNPAID');
        });
    }

    public function down(): void
    {
        Schema::table('quotations', function (Blueprint $table) {
            $table->dropForeign(['payment_transaction_id']);
            $table->dropColumn(['payment_transaction_id', 'payment_status']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['payment_transaction_id']);
            $table->dropColumn(['payment_transaction_id', 'payment_status', 'paid_at']);
        });

        Schema::dropIfExists('saved_payment_methods');
        Schema::dropIfExists('payment_webhooks');
        Schema::dropIfExists('payment_refunds');
        Schema::dropIfExists('payment_transactions');
    }
};
