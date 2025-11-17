<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Create fulltext index on products for search
        DB::statement('ALTER TABLE products ADD FULLTEXT INDEX ft_product_search (title, description)');

        // Search History
        Schema::create('search_history', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->string('search_query', 255);
            $table->integer('results_count')->default(0);
            $table->string('filters', 500)->nullable();
            $table->timestamps();
            
            $table->index(['user_id', 'created_at']);
            $table->index('search_query');
        });

        // Recently Viewed Products
        Schema::create('recently_viewed', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->unsignedBigInteger('product_id');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->integer('view_count')->default(1);
            $table->timestamps();
            
            $table->unique(['user_id', 'product_id']);
            $table->index(['user_id', 'created_at']);
            $table->index('product_id');
        });

        // Popular Searches
        Schema::create('popular_searches', function (Blueprint $table) {
            $table->id();
            $table->string('search_term', 255)->unique();
            $table->integer('search_count')->default(1);
            $table->integer('result_count_avg')->default(0);
            $table->timestamp('last_searched')->useCurrent();
            $table->timestamps();
            
            $table->index('search_count');
            $table->index('search_term');
        });

        // Add search-related columns to products
        Schema::table('products', function (Blueprint $table) {
            $table->text('tags')->nullable()->after('description');
            $table->text('search_keywords')->nullable()->after('tags');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['tags', 'search_keywords']);
        });

        DB::statement('ALTER TABLE products DROP INDEX ft_product_search');
        
        Schema::dropIfExists('popular_searches');
        Schema::dropIfExists('recently_viewed');
        Schema::dropIfExists('search_history');
    }
};
