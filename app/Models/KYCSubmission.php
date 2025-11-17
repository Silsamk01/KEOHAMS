<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class KYCSubmission extends Model
{
    use HasFactory;

    protected $table = 'kyc_submissions';

    protected $fillable = [
        'user_id',
        'status',
        'files',
        'reviewer_id',
        'reviewed_at',
        'rejection_reason',
        'id_type',
        'id_number',
        'id_issue_date',
        'id_expiry_date',
        'id_document_path',
        'live_photo_path',
        'face_match_score',
        'face_match_status',
        'liveness_check_passed',
        'address_line1',
        'address_line2',
        'address_city',
        'address_state',
        'address_country',
        'address_postal_code',
        'address_proof_path',
        'ocr_data',
        'ocr_confidence',
        'ocr_status',
        'document_expired',
        'document_quality_score',
        'admin_remarks',
        'reviewed_by',
        'is_encrypted',
        'encryption_key_id',
        'gdpr_consent',
        'data_retention_date',
    ];

    protected $casts = [
        'files' => 'array',
        'reviewed_at' => 'datetime',
        'id_issue_date' => 'date',
        'id_expiry_date' => 'date',
        'face_match_score' => 'decimal:2',
        'liveness_check_passed' => 'boolean',
        'ocr_data' => 'array',
        'ocr_confidence' => 'decimal:2',
        'document_expired' => 'boolean',
        'document_quality_score' => 'decimal:2',
        'is_encrypted' => 'boolean',
        'gdpr_consent' => 'boolean',
        'data_retention_date' => 'date',
    ];

    // Relationships
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }

    public function auditLogs()
    {
        return $this->hasMany(KYCAuditLog::class, 'kyc_submission_id');
    }

    public function faceMatches()
    {
        return $this->hasMany(KYCFaceMatch::class, 'kyc_submission_id');
    }

    public function ocrResults()
    {
        return $this->hasMany(KYCOCRResult::class, 'kyc_submission_id');
    }

    // Accessors
    public function getIsPendingAttribute()
    {
        return $this->status === 'PENDING';
    }

    public function getIsApprovedAttribute()
    {
        return $this->status === 'APPROVED';
    }

    public function getIsRejectedAttribute()
    {
        return $this->status === 'REJECTED';
    }

    public function getDocumentExpiredAttribute()
    {
        return $this->id_expiry_date && $this->id_expiry_date->isPast();
    }

    public function getFaceMatchPassedAttribute()
    {
        return $this->face_match_status === 'MATCH' && $this->face_match_score >= 80;
    }

    public function getOcrSuccessfulAttribute()
    {
        return $this->ocr_status === 'SUCCESS' && $this->ocr_confidence >= 70;
    }

    // Scopes
    public function scopePending($query)
    {
        return $query->where('status', 'PENDING');
    }

    public function scopeUnderReview($query)
    {
        return $query->where('status', 'UNDER_REVIEW');
    }

    public function scopeApproved($query)
    {
        return $query->where('status', 'APPROVED');
    }

    public function scopeRejected($query)
    {
        return $query->where('status', 'REJECTED');
    }

    // Helper methods
    public function approve($reviewerId, $remarks = null)
    {
        $this->update([
            'status' => 'APPROVED',
            'reviewer_id' => $reviewerId,
            'reviewed_at' => now(),
            'reviewed_by' => $reviewerId,
            'admin_remarks' => $remarks,
        ]);

        // Update user verification state
        $this->user->verificationState()->updateOrCreate(
            ['user_id' => $this->user_id],
            ['status' => 'KYC_VERIFIED']
        );
    }

    public function reject($reviewerId, $reason)
    {
        $this->update([
            'status' => 'REJECTED',
            'reviewer_id' => $reviewerId,
            'reviewed_at' => now(),
            'reviewed_by' => $reviewerId,
            'rejection_reason' => $reason,
        ]);

        // Update user verification state
        $this->user->verificationState()->updateOrCreate(
            ['user_id' => $this->user_id],
            ['status' => 'REJECTED']
        );
    }
}
