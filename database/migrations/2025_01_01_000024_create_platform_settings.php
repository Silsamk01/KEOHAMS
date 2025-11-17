<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_settings', function (Blueprint $table) {
            $table->id();
            $table->string('setting_key', 100)->unique();
            $table->text('setting_value')->nullable();
            $table->enum('value_type', ['STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'TEXT'])->default('STRING');
            $table->string('category', 50)->default('GENERAL');
            $table->string('description')->nullable();
            $table->boolean('is_public')->default(false);
            $table->boolean('is_editable')->default(true);
            $table->timestamps();
            
            $table->index('category');
            $table->index('is_public');
        });

        // Insert default settings
        DB::table('platform_settings')->insert([
            [
                'setting_key' => 'site_name',
                'setting_value' => 'KEOHAMS',
                'value_type' => 'STRING',
                'category' => 'GENERAL',
                'description' => 'Website name',
                'is_public' => true,
                'is_editable' => true,
                'created_at' => now(),
                'updated_at' => now()
            ],
            [
                'setting_key' => 'site_description',
                'setting_value' => 'Wholesale E-commerce Platform',
                'value_type' => 'TEXT',
                'category' => 'GENERAL',
                'description' => 'Website description',
                'is_public' => true,
                'is_editable' => true,
                'created_at' => now(),
                'updated_at' => now()
            ],
            [
                'setting_key' => 'maintenance_mode',
                'setting_value' => 'false',
                'value_type' => 'BOOLEAN',
                'category' => 'SYSTEM',
                'description' => 'Enable maintenance mode',
                'is_public' => true,
                'is_editable' => true,
                'created_at' => now(),
                'updated_at' => now()
            ],
            [
                'setting_key' => 'min_order_amount',
                'setting_value' => '0',
                'value_type' => 'NUMBER',
                'category' => 'ORDERS',
                'description' => 'Minimum order amount',
                'is_public' => true,
                'is_editable' => true,
                'created_at' => now(),
                'updated_at' => now()
            ],
            [
                'setting_key' => 'enable_reviews',
                'setting_value' => 'true',
                'value_type' => 'BOOLEAN',
                'category' => 'FEATURES',
                'description' => 'Enable product reviews',
                'is_public' => true,
                'is_editable' => true,
                'created_at' => now(),
                'updated_at' => now()
            ],
            [
                'setting_key' => 'kyc_required_for_orders',
                'setting_value' => 'false',
                'value_type' => 'BOOLEAN',
                'category' => 'KYC',
                'description' => 'Require KYC verification for orders',
                'is_public' => true,
                'is_editable' => true,
                'created_at' => now(),
                'updated_at' => now()
            ]
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_settings');
    }
};
