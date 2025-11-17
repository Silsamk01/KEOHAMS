<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add is_featured column if it doesn't exist
        if (!Schema::hasColumn('posts', 'is_featured')) {
            Schema::table('posts', function (Blueprint $table) {
                $table->boolean('is_featured')->default(false)->after('require_login');
                $table->index('is_featured');
            });
        }

        // Add slug column to tags if it doesn't exist
        if (!Schema::hasColumn('tags', 'slug')) {
            Schema::table('tags', function (Blueprint $table) {
                $table->string('slug', 100)->unique()->after('name');
            });
        }

        // Add missing indexes for better performance
        if (Schema::hasTable('posts')) {
            Schema::table('posts', function (Blueprint $table) {
                if (!$this->indexExists('posts', 'posts_category_index')) {
                    $table->index('category');
                }
                if (!$this->indexExists('posts', 'posts_author_id_index')) {
                    $table->index('author_id');
                }
            });
        }
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            if (Schema::hasColumn('posts', 'is_featured')) {
                $table->dropIndex(['is_featured']);
                $table->dropColumn('is_featured');
            }
            
            $table->dropIndex(['category']);
            $table->dropIndex(['author_id']);
        });

        Schema::table('tags', function (Blueprint $table) {
            if (Schema::hasColumn('tags', 'slug')) {
                $table->dropUnique(['slug']);
                $table->dropColumn('slug');
            }
        });
    }

    /**
     * Check if an index exists
     */
    protected function indexExists(string $table, string $index): bool
    {
        $sm = Schema::getConnection()->getDoctrineSchemaManager();
        $doctrineTable = $sm->introspectTable($table);
        return $doctrineTable->hasIndex($index);
    }
};
