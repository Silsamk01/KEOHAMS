<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('login_attempts', function (Blueprint $table) {
            $table->id();
            $table->string('email');
            $table->string('ip_address', 45);
            $table->boolean('successful')->default(false);
            $table->string('user_agent')->nullable();
            $table->text('failure_reason')->nullable();
            $table->timestamps();
            
            $table->index(['email', 'created_at']);
            $table->index(['ip_address', 'created_at']);
            $table->index(['successful', 'created_at']);
        });

        Schema::create('security_events', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
            $table->enum('event_type', [
                'LOGIN_FAILED', 
                'LOGIN_SUCCESS', 
                'PASSWORD_CHANGE', 
                'EMAIL_CHANGE', 
                '2FA_ENABLED', 
                '2FA_DISABLED',
                'ACCOUNT_LOCKED',
                'ACCOUNT_UNLOCKED',
                'SUSPICIOUS_ACTIVITY',
                'API_KEY_CREATED',
                'API_KEY_REVOKED',
                'SESSION_HIJACK_ATTEMPT',
                'BRUTE_FORCE_ATTEMPT'
            ]);
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->text('description')->nullable();
            $table->json('metadata')->nullable();
            $table->enum('severity', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])->default('MEDIUM');
            $table->timestamps();
            
            $table->index('user_id');
            $table->index(['event_type', 'created_at']);
            $table->index('severity');
        });

        Schema::create('blocked_ips', function (Blueprint $table) {
            $table->id();
            $table->string('ip_address', 45)->unique();
            $table->enum('reason', ['BRUTE_FORCE', 'SUSPICIOUS_ACTIVITY', 'MANUAL_BLOCK', 'SPAM', 'FRAUD_ATTEMPT']);
            $table->text('notes')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->unsignedBigInteger('blocked_by')->nullable();
            $table->foreign('blocked_by')->references('id')->on('users')->onDelete('set null');
            $table->boolean('is_permanent')->default(false);
            $table->timestamps();
            
            $table->index('ip_address');
            $table->index('expires_at');
        });

        Schema::create('api_keys', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->string('name', 100);
            $table->string('key_hash');
            $table->string('key_prefix', 10);
            $table->json('permissions')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->string('last_used_ip', 45)->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            $table->index('user_id');
            $table->index(['key_prefix', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('api_keys');
        Schema::dropIfExists('blocked_ips');
        Schema::dropIfExists('security_events');
        Schema::dropIfExists('login_attempts');
    }
};
