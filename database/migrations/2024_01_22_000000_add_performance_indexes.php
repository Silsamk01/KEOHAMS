<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Add indexes for users table
        Schema::table('users', function (Blueprint $table) {
            if (!$this->indexExists('users', 'users_email_index')) {
                $table->index('email');
            }
            if (!$this->indexExists('users', 'users_role_index')) {
                $table->index('role');
            }
            if (!$this->indexExists('users', 'users_is_active_index')) {
                $table->index('is_active');
            }
            if (!$this->indexExists('users', 'users_created_at_index')) {
                $table->index('created_at');
            }
        });

        // Add indexes for products table
        Schema::table('products', function (Blueprint $table) {
            if (!$this->indexExists('products', 'products_slug_index')) {
                $table->index('slug');
            }
            if (!$this->indexExists('products', 'products_status_index')) {
                $table->index('status');
            }
            if (!$this->indexExists('products', 'products_category_id_index')) {
                $table->index('category_id');
            }
            if (!$this->indexExists('products', 'products_is_featured_index')) {
                $table->index('is_featured');
            }
            if (!$this->indexExists('products', 'products_price_index')) {
                $table->index('price');
            }
            if (!$this->indexExists('products', 'products_quantity_index')) {
                $table->index('quantity');
            }
            if (!$this->indexExists('products', 'products_created_at_index')) {
                $table->index('created_at');
            }
        });

        // Add indexes for orders table
        Schema::table('orders', function (Blueprint $table) {
            if (!$this->indexExists('orders', 'orders_user_id_index')) {
                $table->index('user_id');
            }
            if (!$this->indexExists('orders', 'orders_status_index')) {
                $table->index('status');
            }
            if (!$this->indexExists('orders', 'orders_payment_status_index')) {
                $table->index('payment_status');
            }
            if (!$this->indexExists('orders', 'orders_order_number_index')) {
                $table->index('order_number');
            }
            if (!$this->indexExists('orders', 'orders_created_at_index')) {
                $table->index('created_at');
            }
        });

        // Add indexes for notifications table
        Schema::table('notifications', function (Blueprint $table) {
            if (!$this->indexExists('notifications', 'notifications_user_id_index')) {
                $table->index('user_id');
            }
            if (!$this->indexExists('notifications', 'notifications_is_read_index')) {
                $table->index('is_read');
            }
            if (!$this->indexExists('notifications', 'notifications_type_index')) {
                $table->index('type');
            }
            if (!$this->indexExists('notifications', 'notifications_created_at_index')) {
                $table->index('created_at');
            }
        });

        // Add composite indexes
        Schema::table('notifications', function (Blueprint $table) {
            if (!$this->indexExists('notifications', 'notifications_user_id_is_read_index')) {
                $table->index(['user_id', 'is_read']);
            }
        });

        Schema::table('orders', function (Blueprint $table) {
            if (!$this->indexExists('orders', 'orders_user_id_status_index')) {
                $table->index(['user_id', 'status']);
            }
        });

        Schema::table('products', function (Blueprint $table) {
            if (!$this->indexExists('products', 'products_category_id_status_index')) {
                $table->index(['category_id', 'status']);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['email']);
            $table->dropIndex(['role']);
            $table->dropIndex(['is_active']);
            $table->dropIndex(['created_at']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['slug']);
            $table->dropIndex(['status']);
            $table->dropIndex(['category_id']);
            $table->dropIndex(['is_featured']);
            $table->dropIndex(['price']);
            $table->dropIndex(['quantity']);
            $table->dropIndex(['created_at']);
            $table->dropIndex(['category_id', 'status']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['user_id']);
            $table->dropIndex(['status']);
            $table->dropIndex(['payment_status']);
            $table->dropIndex(['order_number']);
            $table->dropIndex(['created_at']);
            $table->dropIndex(['user_id', 'status']);
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex(['user_id']);
            $table->dropIndex(['is_read']);
            $table->dropIndex(['type']);
            $table->dropIndex(['created_at']);
            $table->dropIndex(['user_id', 'is_read']);
        });
    }

    /**
     * Check if index exists
     */
    private function indexExists($table, $index)
    {
        $connection = Schema::getConnection();
        $doctrineSchemaManager = $connection->getDoctrineSchemaManager();
        $doctrineTable = $doctrineSchemaManager->listTableDetails($table);
        
        return $doctrineTable->hasIndex($index);
    }
};
