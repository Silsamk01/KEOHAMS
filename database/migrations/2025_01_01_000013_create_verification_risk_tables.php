<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // User verification state table
        Schema::create('user_verification_state', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->unique();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->enum('status', ['UNVERIFIED','BASIC_PENDING','BASIC_VERIFIED','KYC_PENDING','KYC_VERIFIED','REJECTED','LOCKED'])->default('UNVERIFIED');
            $table->integer('risk_score')->default(0);
            $table->enum('risk_level', ['LOW','MEDIUM','HIGH','CRITICAL'])->default('LOW');
            $table->boolean('manual_lock')->default(false);
            $table->text('lock_reason')->nullable();
            $table->timestamp('locked_at')->nullable();
            $table->timestamp('basic_verified_at')->nullable();
            $table->unsignedBigInteger('kyc_submission_id')->nullable();
            $table->foreign('kyc_submission_id')->references('id')->on('kyc_submissions')->onDelete('set null');
            $table->timestamp('kyc_verified_at')->nullable();
            $table->timestamps();
            
            $table->index('status');
            $table->index('risk_level');
            $table->index('risk_score');
        });

        // Risk events table
        Schema::create('risk_events', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->string('event_type');
            $table->integer('delta')->default(0);
            $table->integer('resulting_score')->default(0);
            $table->enum('resulting_level', ['LOW','MEDIUM','HIGH','CRITICAL'])->default('LOW');
            $table->text('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();
            
            $table->index('user_id');
            $table->index('event_type');
        });

        // Extend KYC submissions with verification fields
        Schema::table('kyc_submissions', function (Blueprint $table) {
            $table->string('doc_country', 2)->nullable();
            $table->string('doc_type')->nullable();
            $table->string('doc_hash')->nullable();
            $table->integer('escalation_level')->default(0);
            $table->string('fail_reason_code')->nullable();
            $table->integer('risk_score_at_submission')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('kyc_submissions', function (Blueprint $table) {
            $table->dropColumn(['doc_country', 'doc_type', 'doc_hash', 'escalation_level', 'fail_reason_code', 'risk_score_at_submission']);
        });
        
        Schema::dropIfExists('risk_events');
        Schema::dropIfExists('user_verification_state');
    }
};
