<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('currencies', function (Blueprint $table) {
            $table->id();
            $table->string('code', 3)->unique();
            $table->string('name', 100);
            $table->string('symbol', 10);
            $table->decimal('exchange_rate', 12, 6)->default(1.000000);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_default')->default(false);
            $table->timestamps();
            
            $table->index('is_active');
        });

        // Insert default currency
        DB::table('currencies')->insert([
            'code' => 'NGN',
            'name' => 'Nigerian Naira',
            'symbol' => '₦',
            'exchange_rate' => 1.000000,
            'is_active' => true,
            'is_default' => true,
            'created_at' => now(),
            'updated_at' => now()
        ]);

        Schema::create('currency_exchange_rates', function (Blueprint $table) {
            $table->id();
            $table->string('from_currency', 3);
            $table->string('to_currency', 3);
            $table->decimal('rate', 12, 6);
            $table->string('source', 50)->nullable();
            $table->timestamp('effective_at');
            $table->timestamps();
            
            $table->index(['from_currency', 'to_currency']);
            $table->index('effective_at');
        });

        // Add currency to products
        Schema::table('products', function (Blueprint $table) {
            $table->string('currency', 3)->default('NGN')->after('price_per_unit');
        });

        // Add currency to orders
        Schema::table('orders', function (Blueprint $table) {
            $table->string('currency', 3)->default('NGN')->after('total_amount');
        });

        // Add currency to quotations
        Schema::table('quotations', function (Blueprint $table) {
            $table->string('currency', 3)->default('NGN')->after('total_amount');
        });
    }

    public function down(): void
    {
        Schema::table('quotations', function (Blueprint $table) {
            $table->dropColumn('currency');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('currency');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('currency');
        });

        Schema::dropIfExists('currency_exchange_rates');
        Schema::dropIfExists('currencies');
    }
};
