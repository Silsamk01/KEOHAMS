<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Standalone affiliate accounts (separate from users)
        Schema::create('affiliate_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('email')->unique();
            $table->string('password_hash');
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('phone', 20)->nullable();
            $table->string('company_name', 200)->nullable();
            $table->text('address')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('state', 100)->nullable();
            $table->string('country', 100)->nullable();
            $table->string('referral_code', 20)->unique();
            $table->unsignedBigInteger('parent_affiliate_id')->nullable();
            $table->foreign('parent_affiliate_id')->references('id')->on('affiliate_accounts')->onDelete('set null');
            $table->enum('status', ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'])->default('PENDING');
            $table->boolean('email_verified')->default(false);
            $table->string('verification_token', 64)->nullable();
            $table->timestamp('email_verified_at')->nullable();
            $table->decimal('total_earnings', 15, 2)->default(0);
            $table->decimal('available_balance', 15, 2)->default(0);
            $table->decimal('pending_balance', 15, 2)->default(0);
            $table->integer('direct_referrals')->default(0);
            $table->integer('total_downline')->default(0);
            $table->string('bank_name', 100)->nullable();
            $table->string('account_number', 50)->nullable();
            $table->string('account_name', 200)->nullable();
            $table->json('payment_details')->nullable();
            $table->string('remember_token', 100)->nullable();
            $table->integer('token_version')->default(1);
            $table->softDeletes();
            $table->timestamps();
            
            $table->index('email');
            $table->index('referral_code');
            $table->index('status');
            $table->index('parent_affiliate_id');
        });

        // Update affiliate_sales to support standalone affiliates
        Schema::table('affiliate_sales', function (Blueprint $table) {
            $table->unsignedBigInteger('affiliate_account_id')->nullable()->after('affiliate_id');
            $table->foreign('affiliate_account_id')->references('id')->on('affiliate_accounts')->onDelete('cascade');
        });

        // Update commission_records to support standalone affiliates
        Schema::table('commission_records', function (Blueprint $table) {
            $table->unsignedBigInteger('affiliate_account_id')->nullable()->after('affiliate_id');
            $table->foreign('affiliate_account_id')->references('id')->on('affiliate_accounts')->onDelete('cascade');
        });

        // Update affiliate_withdrawals to support standalone affiliates
        Schema::table('affiliate_withdrawals', function (Blueprint $table) {
            $table->unsignedBigInteger('affiliate_account_id')->nullable()->after('affiliate_id');
            $table->foreign('affiliate_account_id')->references('id')->on('affiliate_accounts')->onDelete('cascade');
        });

        // Affiliate verification tokens
        Schema::create('affiliate_verification_tokens', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('affiliate_account_id');
            $table->foreign('affiliate_account_id')->references('id')->on('affiliate_accounts')->onDelete('cascade');
            $table->string('token', 64)->unique();
            $table->enum('type', ['EMAIL_VERIFICATION', 'PASSWORD_RESET']);
            $table->timestamp('expires_at');
            $table->boolean('used')->default(false);
            $table->timestamps();
            
            $table->index(['affiliate_account_id', 'type']);
            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('affiliate_verification_tokens');
        
        Schema::table('affiliate_withdrawals', function (Blueprint $table) {
            $table->dropForeign(['affiliate_account_id']);
            $table->dropColumn('affiliate_account_id');
        });

        Schema::table('commission_records', function (Blueprint $table) {
            $table->dropForeign(['affiliate_account_id']);
            $table->dropColumn('affiliate_account_id');
        });

        Schema::table('affiliate_sales', function (Blueprint $table) {
            $table->dropForeign(['affiliate_account_id']);
            $table->dropColumn('affiliate_account_id');
        });

        Schema::dropIfExists('affiliate_accounts');
    }
};
