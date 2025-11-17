<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Email Marketing Templates
        Schema::create('email_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('slug', 100)->unique();
            $table->string('subject', 255);
            $table->text('html_content');
            $table->text('text_content')->nullable();
            $table->enum('category', ['MARKETING', 'TRANSACTIONAL', 'NOTIFICATION', 'NEWSLETTER'])->default('MARKETING');
            $table->json('variables')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            $table->timestamps();
            
            $table->index('category');
            $table->index('is_active');
        });

        // Email Marketing Campaigns
        Schema::create('email_marketing_campaigns', function (Blueprint $table) {
            $table->id();
            $table->string('name', 200);
            $table->unsignedBigInteger('template_id');
            $table->foreign('template_id')->references('id')->on('email_templates')->onDelete('cascade');
            $table->enum('target_audience', ['ALL_USERS', 'CUSTOMERS_ONLY', 'AFFILIATES_ONLY', 'NEWSLETTER_SUBSCRIBERS', 'CUSTOM'])->default('ALL_USERS');
            $table->json('filters')->nullable();
            $table->enum('status', ['DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'PAUSED', 'CANCELLED'])->default('DRAFT');
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->integer('total_recipients')->default(0);
            $table->integer('sent_count')->default(0);
            $table->integer('delivered_count')->default(0);
            $table->integer('opened_count')->default(0);
            $table->integer('clicked_count')->default(0);
            $table->integer('bounced_count')->default(0);
            $table->integer('unsubscribed_count')->default(0);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            $table->timestamps();
            
            $table->index('status');
            $table->index('scheduled_at');
        });

        // Email Campaign Recipients
        Schema::create('email_campaign_recipients', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('campaign_id');
            $table->foreign('campaign_id')->references('id')->on('email_marketing_campaigns')->onDelete('cascade');
            $table->string('email');
            $table->string('name', 255)->nullable();
            $table->enum('status', ['PENDING', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'FAILED'])->default('PENDING');
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('clicked_at')->nullable();
            $table->integer('open_count')->default(0);
            $table->integer('click_count')->default(0);
            $table->text('error_message')->nullable();
            $table->timestamps();
            
            $table->index('campaign_id');
            $table->index('status');
        });

        // Email Marketing Automation Rules
        Schema::create('email_automation_rules', function (Blueprint $table) {
            $table->id();
            $table->string('name', 200);
            $table->enum('trigger_type', [
                'USER_REGISTERED',
                'ORDER_PLACED',
                'ORDER_CANCELLED',
                'CART_ABANDONED',
                'PRODUCT_BACK_IN_STOCK',
                'PRICE_DROP',
                'BIRTHDAY',
                'KYC_APPROVED',
                'KYC_REJECTED',
                'AFFILIATE_SIGNUP'
            ]);
            $table->unsignedBigInteger('template_id');
            $table->foreign('template_id')->references('id')->on('email_templates')->onDelete('cascade');
            $table->integer('delay_minutes')->default(0);
            $table->json('conditions')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            $table->index('trigger_type');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_automation_rules');
        Schema::dropIfExists('email_campaign_recipients');
        Schema::dropIfExists('email_marketing_campaigns');
        Schema::dropIfExists('email_templates');
    }
};
