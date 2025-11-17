<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Affiliates table
        Schema::create('affiliates', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->string('referral_code', 20)->unique();
            $table->unsignedBigInteger('parent_affiliate_id')->nullable();
            $table->foreign('parent_affiliate_id')->references('id')->on('affiliates')->onDelete('set null');
            $table->decimal('total_earnings', 15, 2)->default(0);
            $table->decimal('available_balance', 15, 2)->default(0);
            $table->decimal('pending_balance', 15, 2)->default(0);
            $table->integer('direct_referrals')->default(0);
            $table->integer('total_downline')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            $table->index('user_id');
            $table->index('parent_affiliate_id');
            $table->index(['is_active', 'created_at']);
        });

        // Affiliate Sales
        Schema::create('affiliate_sales', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('affiliate_id');
            $table->foreign('affiliate_id')->references('id')->on('affiliates')->onDelete('cascade');
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->foreign('customer_id')->references('id')->on('users')->onDelete('set null');
            $table->string('sale_reference')->unique();
            $table->decimal('sale_amount', 15, 2);
            $table->enum('payment_method', ['ONLINE', 'BANK_TRANSFER', 'CASH', 'OTHER']);
            $table->text('payment_details')->nullable();
            $table->enum('verification_status', ['PENDING', 'VERIFIED', 'REJECTED'])->default('PENDING');
            $table->unsignedBigInteger('verified_by')->nullable();
            $table->foreign('verified_by')->references('id')->on('users')->onDelete('set null');
            $table->timestamp('verified_at')->nullable();
            $table->text('verification_notes')->nullable();
            $table->boolean('commissions_paid')->default(false);
            $table->timestamp('commissions_paid_at')->nullable();
            $table->timestamps();
            
            $table->index('affiliate_id');
            $table->index('customer_id');
            $table->index(['verification_status', 'created_at']);
            $table->index(['commissions_paid', 'verification_status']);
        });

        // Commission Records
        Schema::create('commission_records', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('sale_id');
            $table->foreign('sale_id')->references('id')->on('affiliate_sales')->onDelete('cascade');
            $table->unsignedBigInteger('affiliate_id');
            $table->foreign('affiliate_id')->references('id')->on('affiliates')->onDelete('cascade');
            $table->integer('level');
            $table->decimal('commission_rate', 5, 2);
            $table->decimal('commission_amount', 15, 2);
            $table->enum('status', ['PENDING', 'PAID', 'CANCELLED'])->default('PENDING');
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
            
            $table->index('sale_id');
            $table->index('affiliate_id');
            $table->index(['affiliate_id', 'status']);
            $table->index(['level', 'status']);
            $table->unique(['sale_id', 'affiliate_id', 'level']);
        });

        // Commission Settings
        Schema::create('commission_settings', function (Blueprint $table) {
            $table->id();
            $table->integer('level')->unique();
            $table->decimal('rate', 5, 2);
            $table->decimal('max_total_rate', 5, 2)->default(25.00);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Insert default commission settings
        DB::table('commission_settings')->insert([
            ['level' => 0, 'rate' => 10.00, 'max_total_rate' => 25.00, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['level' => 1, 'rate' => 2.50, 'max_total_rate' => 25.00, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['level' => 2, 'rate' => 2.50, 'max_total_rate' => 25.00, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Affiliate Withdrawals
        Schema::create('affiliate_withdrawals', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('affiliate_id');
            $table->foreign('affiliate_id')->references('id')->on('affiliates')->onDelete('cascade');
            $table->decimal('amount', 15, 2);
            $table->enum('method', ['BANK_TRANSFER', 'PAYPAL', 'MOBILE_MONEY', 'CRYPTO']);
            $table->json('payment_details');
            $table->enum('status', ['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED'])->default('PENDING');
            $table->unsignedBigInteger('processed_by')->nullable();
            $table->foreign('processed_by')->references('id')->on('users')->onDelete('set null');
            $table->timestamp('processed_at')->nullable();
            $table->text('processing_notes')->nullable();
            $table->string('transaction_reference')->nullable();
            $table->timestamps();
            
            $table->index('affiliate_id');
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('affiliate_withdrawals');
        Schema::dropIfExists('commission_settings');
        Schema::dropIfExists('commission_records');
        Schema::dropIfExists('affiliate_sales');
        Schema::dropIfExists('affiliates');
    }
};
