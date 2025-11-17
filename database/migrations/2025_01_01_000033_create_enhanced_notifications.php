<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Notification Preferences
        Schema::create('notification_preferences', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->enum('notification_type', [
                'ORDER_UPDATE',
                'PAYMENT_CONFIRMATION',
                'SHIPPING_UPDATE',
                'PRICE_DROP',
                'PRODUCT_RESTOCK',
                'SUPPORT_REPLY',
                'MARKETING',
                'NEWSLETTER',
                'REVIEW_REPLY',
                'WISHLIST_ALERT',
                'AFFILIATE_COMMISSION'
            ]);
            $table->boolean('email_enabled')->default(true);
            $table->boolean('sms_enabled')->default(false);
            $table->boolean('push_enabled')->default(true);
            $table->boolean('in_app_enabled')->default(true);
            $table->timestamps();
            
            $table->unique(['user_id', 'notification_type']);
            $table->index('user_id');
        });

        // Notification Templates
        Schema::create('notification_templates', function (Blueprint $table) {
            $table->id();
            $table->string('template_key', 100)->unique();
            $table->string('name', 200);
            $table->enum('channel', ['EMAIL', 'SMS', 'PUSH', 'IN_APP']);
            $table->string('subject', 200)->nullable();
            $table->text('body_template');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            $table->index('template_key');
            $table->index('channel');
        });

        // SMS Logs
        Schema::create('sms_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
            $table->string('phone_number', 20);
            $table->text('message');
            $table->enum('status', ['PENDING', 'SENT', 'FAILED', 'DELIVERED'])->default('PENDING');
            $table->string('provider', 50)->nullable();
            $table->string('provider_message_id', 100)->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();
            
            $table->index('user_id');
            $table->index('phone_number');
            $table->index(['status', 'created_at']);
        });

        // Add phone verification to users
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('phone_verified')->default(false)->after('email_verified');
            $table->timestamp('phone_verified_at')->nullable()->after('phone_verified');
        });

        // Enhance notifications table
        Schema::table('notifications', function (Blueprint $table) {
            $table->enum('priority', ['LOW', 'MEDIUM', 'HIGH', 'URGENT'])->default('MEDIUM')->after('message');
            $table->enum('channel', ['IN_APP', 'EMAIL', 'SMS', 'PUSH'])->default('IN_APP')->after('priority');
            $table->string('action_url', 500)->nullable()->after('channel');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropColumn(['priority', 'channel', 'action_url']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['phone_verified', 'phone_verified_at']);
        });

        Schema::dropIfExists('sms_logs');
        Schema::dropIfExists('notification_templates');
        Schema::dropIfExists('notification_preferences');
    }
};
