<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->foreign('parent_id')->references('id')->on('categories')->onDelete('set null');
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description')->nullable();
            $table->integer('moq')->default(1);
            $table->decimal('price_per_unit', 12, 2);
            $table->enum('stock_status', ['IN_STOCK', 'OUT_OF_STOCK', 'PREORDER'])->default('IN_STOCK');
            $table->unsignedBigInteger('category_id')->nullable();
            $table->foreign('category_id')->references('id')->on('categories')->onDelete('set null');
            $table->json('images')->nullable();
            $table->json('videos')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('bulk_discounts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->integer('min_qty');
            $table->integer('max_qty')->nullable();
            $table->decimal('unit_price', 12, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bulk_discounts');
        Schema::dropIfExists('products');
        Schema::dropIfExists('categories');
    }
};
