<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Analytics Events
        Schema::create('analytics_events', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
            $table->string('event_type', 100);
            $table->string('event_category', 50)->nullable();
            $table->string('event_label', 255)->nullable();
            $table->decimal('event_value', 15, 2)->nullable();
            $table->json('metadata')->nullable();
            $table->string('session_id', 64)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->string('referrer')->nullable();
            $table->timestamps();
            
            $table->index('user_id');
            $table->index(['event_type', 'created_at']);
            $table->index('session_id');
            $table->index('created_at');
        });

        // Page Views
        Schema::create('page_views', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
            $table->string('url');
            $table->string('page_title')->nullable();
            $table->string('referrer')->nullable();
            $table->integer('time_on_page')->nullable();
            $table->string('session_id', 64)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->string('device_type', 20)->nullable();
            $table->string('browser', 50)->nullable();
            $table->string('os', 50)->nullable();
            $table->timestamps();
            
            $table->index('user_id');
            $table->index('session_id');
            $table->index('created_at');
            $table->index(['url', 'created_at']);
        });

        // Product Analytics
        Schema::create('product_views', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
            $table->string('session_id', 64)->nullable();
            $table->string('referrer')->nullable();
            $table->integer('time_spent')->nullable();
            $table->timestamps();
            
            $table->index('product_id');
            $table->index('user_id');
            $table->index('created_at');
        });

        Schema::create('cart_abandonment', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
            $table->string('session_id', 64);
            $table->json('cart_items');
            $table->decimal('cart_total', 15, 2);
            $table->boolean('recovered')->default(false);
            $table->unsignedBigInteger('order_id')->nullable();
            $table->foreign('order_id')->references('id')->on('orders')->onDelete('set null');
            $table->timestamp('recovered_at')->nullable();
            $table->timestamps();
            
            $table->index('user_id');
            $table->index('session_id');
            $table->index(['recovered', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cart_abandonment');
        Schema::dropIfExists('product_views');
        Schema::dropIfExists('page_views');
        Schema::dropIfExists('analytics_events');
    }
};
