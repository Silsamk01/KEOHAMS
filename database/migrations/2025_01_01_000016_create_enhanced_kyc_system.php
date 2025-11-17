<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Extend kyc_submissions with enhanced fields
        Schema::table('kyc_submissions', function (Blueprint $table) {
            $table->enum('id_type', ['NATIONAL_ID', 'DRIVERS_LICENSE', 'PASSPORT', 'OTHER'])->nullable();
            $table->string('id_number', 100)->nullable();
            $table->date('id_issue_date')->nullable();
            $table->date('id_expiry_date')->nullable();
            $table->string('id_document_path', 500)->nullable();
            $table->string('live_photo_path', 500)->nullable();
            $table->decimal('face_match_score', 5, 2)->nullable();
            $table->enum('face_match_status', ['PENDING', 'MATCHED', 'NOT_MATCHED', 'ERROR'])->default('PENDING');
            $table->boolean('liveness_check_passed')->nullable();
            $table->enum('address_proof_type', ['UTILITY_BILL', 'BANK_STATEMENT', 'RENTAL_AGREEMENT', 'OTHER'])->nullable();
            $table->string('address_proof_path', 500)->nullable();
            $table->date('address_proof_date')->nullable();
            $table->text('residential_address')->nullable();
            $table->json('ocr_data')->nullable();
            $table->decimal('ocr_confidence', 5, 2)->nullable();
            $table->enum('ocr_status', ['PENDING', 'SUCCESS', 'FAILED', 'MANUAL_REVIEW'])->default('PENDING');
            $table->boolean('document_expired')->default(false);
            $table->decimal('document_quality_score', 5, 2)->nullable();
            $table->text('admin_remarks')->nullable();
            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->foreign('reviewed_by')->references('id')->on('users');
            $table->boolean('is_encrypted')->default(false);
            $table->string('encryption_key_id', 100)->nullable();
            $table->boolean('gdpr_consent')->default(false);
            $table->timestamp('data_retention_date')->nullable();
        });

        // KYC Audit Log
        Schema::create('kyc_audit_log', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('kyc_submission_id');
            $table->foreign('kyc_submission_id')->references('id')->on('kyc_submissions')->onDelete('cascade');
            $table->unsignedBigInteger('user_id');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->unsignedBigInteger('admin_id')->nullable();
            $table->foreign('admin_id')->references('id')->on('users')->onDelete('set null');
            $table->enum('action', ['SUBMITTED','DOCUMENT_UPLOADED','OCR_PROCESSED','FACE_VERIFIED','ADMIN_REVIEWED','APPROVED','REJECTED','RESUBMIT_REQUESTED','DOCUMENT_EXPIRED','DATA_DELETED']);
            $table->enum('status_before', ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESUBMIT_REQUIRED'])->nullable();
            $table->enum('status_after', ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESUBMIT_REQUIRED'])->nullable();
            $table->text('remarks')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();
            
            $table->index('kyc_submission_id');
            $table->index('user_id');
            $table->index('admin_id');
            $table->index('action');
        });

        // KYC Face Matches
        Schema::create('kyc_face_matches', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('kyc_submission_id');
            $table->foreign('kyc_submission_id')->references('id')->on('kyc_submissions')->onDelete('cascade');
            $table->string('id_face_path', 500)->nullable();
            $table->string('selfie_face_path', 500)->nullable();
            $table->decimal('similarity_score', 5, 2)->nullable();
            $table->json('face_landmarks')->nullable();
            $table->boolean('liveness_passed')->default(false);
            $table->json('liveness_checks')->nullable();
            $table->enum('match_status', ['MATCHED', 'NOT_MATCHED', 'UNCERTAIN', 'ERROR']);
            $table->text('error_message')->nullable();
            $table->timestamp('processed_at')->useCurrent();
            
            $table->index('kyc_submission_id');
            $table->index('match_status');
        });

        // KYC OCR Results
        Schema::create('kyc_ocr_results', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('kyc_submission_id');
            $table->foreign('kyc_submission_id')->references('id')->on('kyc_submissions')->onDelete('cascade');
            $table->enum('document_type', ['ID', 'ADDRESS_PROOF']);
            $table->json('extracted_text')->nullable();
            $table->json('parsed_fields')->nullable();
            $table->decimal('confidence_score', 5, 2)->nullable();
            $table->boolean('requires_manual_review')->default(false);
            $table->text('manual_corrections')->nullable();
            $table->timestamp('processed_at')->useCurrent();
            
            $table->index('kyc_submission_id');
            $table->index('document_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kyc_ocr_results');
        Schema::dropIfExists('kyc_face_matches');
        Schema::dropIfExists('kyc_audit_log');
        
        Schema::table('kyc_submissions', function (Blueprint $table) {
            $table->dropForeign(['reviewed_by']);
            $table->dropColumn([
                'id_type', 'id_number', 'id_issue_date', 'id_expiry_date', 'id_document_path',
                'live_photo_path', 'face_match_score', 'face_match_status', 'liveness_check_passed',
                'address_proof_type', 'address_proof_path', 'address_proof_date', 'residential_address',
                'ocr_data', 'ocr_confidence', 'ocr_status', 'document_expired', 'document_quality_score',
                'admin_remarks', 'reviewed_by', 'is_encrypted', 'encryption_key_id',
                'gdpr_consent', 'data_retention_date'
            ]);
        });
    }
};
