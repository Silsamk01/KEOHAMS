<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_movements', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->enum('movement_type', ['IN', 'OUT', 'ADJUSTMENT', 'RETURN', 'DAMAGE', 'LOST'])->default('ADJUSTMENT');
            $table->integer('quantity');
            $table->integer('previous_quantity');
            $table->integer('new_quantity');
            $table->string('reference_type', 50)->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('performed_by')->nullable();
            $table->foreign('performed_by')->references('id')->on('users')->onDelete('set null');
            $table->timestamps();
            
            $table->index('product_id');
            $table->index(['reference_type', 'reference_id']);
            $table->index('movement_type');
            $table->index('created_at');
        });

        Schema::create('stock_alerts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->integer('threshold');
            $table->enum('alert_type', ['LOW_STOCK', 'OUT_OF_STOCK', 'OVERSTOCK'])->default('LOW_STOCK');
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_triggered_at')->nullable();
            $table->integer('trigger_count')->default(0);
            $table->timestamps();
            
            $table->index(['product_id', 'is_active']);
            $table->index('alert_type');
        });

        // Add inventory fields to products
        Schema::table('products', function (Blueprint $table) {
            $table->integer('low_stock_threshold')->default(10)->after('stock_quantity');
            $table->integer('reorder_point')->default(5)->after('low_stock_threshold');
            $table->integer('reorder_quantity')->default(50)->after('reorder_point');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['low_stock_threshold', 'reorder_point', 'reorder_quantity']);
        });

        Schema::dropIfExists('stock_alerts');
        Schema::dropIfExists('inventory_movements');
    }
};
