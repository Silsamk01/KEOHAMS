<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Affiliate Clicks Tracking
        Schema::create('affiliate_clicks', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('affiliate_id')->nullable();
            $table->foreign('affiliate_id')->references('id')->on('affiliates')->onDelete('cascade');
            $table->unsignedBigInteger('affiliate_account_id')->nullable();
            $table->foreign('affiliate_account_id')->references('id')->on('affiliate_accounts')->onDelete('cascade');
            $table->string('referral_code', 50);
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->string('referrer_url', 500)->nullable();
            $table->string('landing_page', 500)->nullable();
            $table->unsignedBigInteger('referred_user_id')->nullable();
            $table->foreign('referred_user_id')->references('id')->on('users')->onDelete('set null');
            $table->string('session_id', 100)->nullable();
            $table->timestamps();
            
            $table->index('affiliate_id');
            $table->index('affiliate_account_id');
            $table->index('referral_code');
            $table->index('referred_user_id');
            $table->index('created_at');
        });

        // Affiliate Conversions
        Schema::create('affiliate_conversions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('affiliate_id')->nullable();
            $table->foreign('affiliate_id')->references('id')->on('affiliates')->onDelete('cascade');
            $table->unsignedBigInteger('affiliate_account_id')->nullable();
            $table->foreign('affiliate_account_id')->references('id')->on('affiliate_accounts')->onDelete('cascade');
            $table->unsignedBigInteger('click_id')->nullable();
            $table->foreign('click_id')->references('id')->on('affiliate_clicks')->onDelete('set null');
            $table->unsignedBigInteger('order_id');
            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
            $table->unsignedBigInteger('user_id');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->decimal('order_amount', 12, 2);
            $table->decimal('commission_amount', 12, 2);
            $table->decimal('commission_rate', 5, 2);
            $table->enum('status', ['PENDING', 'APPROVED', 'REJECTED', 'PAID'])->default('PENDING');
            $table->text('rejection_reason')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
            
            $table->index('affiliate_id');
            $table->index('affiliate_account_id');
            $table->index('order_id');
            $table->index('user_id');
            $table->index('status');
        });

        // Custom Commission Rates
        Schema::create('custom_commission_rates', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('affiliate_id')->nullable();
            $table->foreign('affiliate_id')->references('id')->on('affiliates')->onDelete('cascade');
            $table->unsignedBigInteger('affiliate_account_id')->nullable();
            $table->foreign('affiliate_account_id')->references('id')->on('affiliate_accounts')->onDelete('cascade');
            $table->enum('rate_type', ['PRODUCT', 'CATEGORY', 'GLOBAL']);
            $table->unsignedBigInteger('product_id')->nullable();
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->unsignedBigInteger('category_id')->nullable();
            $table->foreign('category_id')->references('id')->on('categories')->onDelete('cascade');
            $table->decimal('commission_rate', 5, 2);
            $table->boolean('is_active')->default(true);
            $table->date('valid_from')->nullable();
            $table->date('valid_until')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            $table->timestamps();
            
            $table->index('affiliate_id');
            $table->index('affiliate_account_id');
            $table->index('product_id');
            $table->index('category_id');
        });

        // Add performance metrics to affiliates
        Schema::table('affiliates', function (Blueprint $table) {
            $table->integer('total_clicks')->unsigned()->default(0)->after('total_downline');
            $table->integer('total_conversions')->unsigned()->default(0)->after('total_clicks');
            $table->decimal('conversion_rate', 5, 2)->default(0)->after('total_conversions');
        });

        // Add performance metrics to affiliate_accounts
        Schema::table('affiliate_accounts', function (Blueprint $table) {
            $table->integer('total_clicks')->unsigned()->default(0)->after('total_downline');
            $table->integer('total_conversions')->unsigned()->default(0)->after('total_clicks');
            $table->decimal('conversion_rate', 5, 2)->default(0)->after('total_conversions');
        });
    }

    public function down(): void
    {
        Schema::table('affiliate_accounts', function (Blueprint $table) {
            $table->dropColumn(['total_clicks', 'total_conversions', 'conversion_rate']);
        });

        Schema::table('affiliates', function (Blueprint $table) {
            $table->dropColumn(['total_clicks', 'total_conversions', 'conversion_rate']);
        });

        Schema::dropIfExists('custom_commission_rates');
        Schema::dropIfExists('affiliate_conversions');
        Schema::dropIfExists('affiliate_clicks');
    }
};
