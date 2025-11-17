<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Wishlists
        Schema::create('wishlists', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->string('name', 100)->default('My Wishlist');
            $table->boolean('is_private')->default(false);
            $table->string('share_token', 32)->nullable()->unique();
            $table->timestamps();
            
            $table->index('user_id');
        });

        // Wishlist Items
        Schema::create('wishlist_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('wishlist_id');
            $table->foreign('wishlist_id')->references('id')->on('wishlists')->onDelete('cascade');
            $table->unsignedBigInteger('product_id');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->integer('desired_quantity')->default(1);
            $table->decimal('price_when_added', 12, 2);
            $table->text('notes')->nullable();
            $table->timestamps();
            
            $table->unique(['wishlist_id', 'product_id']);
            $table->index('wishlist_id');
            $table->index('product_id');
        });

        // Price Drop Alerts
        Schema::create('price_drop_alerts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->unsignedBigInteger('product_id');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->decimal('target_price', 12, 2);
            $table->decimal('original_price', 12, 2);
            $table->boolean('is_active')->default(true);
            $table->timestamp('triggered_at')->nullable();
            $table->boolean('notification_sent')->default(false);
            $table->timestamps();
            
            $table->index(['user_id', 'is_active']);
            $table->index(['product_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('price_drop_alerts');
        Schema::dropIfExists('wishlist_items');
        Schema::dropIfExists('wishlists');
    }
};
