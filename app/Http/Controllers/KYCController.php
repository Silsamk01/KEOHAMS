<?php

namespace App\Http\Controllers;

use App\Models\KYCSubmission;
use App\Models\User;
use App\Models\ActivityLog;
use App\Mail\KYCStatusEmail;
use App\Jobs\ProcessKYCOCR;
use App\Jobs\ProcessFaceMatch;
use App\Jobs\ProcessDocumentQuality;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

class KYCController extends Controller
{
    /**
     * Get KYC submission for authenticated user
     */
    public function show(Request $request)
    {
        $kyc = KYCSubmission::with(['user', 'reviewer'])
            ->where('user_id', $request->user()->id)
            ->latest()
            ->first();

        if (!$kyc) {
            return response()->json(['message' => 'No KYC submission found.'], 404);
        }

        return response()->json($kyc);
    }

    /**
     * Submit KYC documents
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'id_type' => 'required|in:PASSPORT,DRIVERS_LICENSE,NATIONAL_ID,VOTERS_CARD,OTHER',
            'id_number' => 'required|string|max:100',
            'id_issue_date' => 'nullable|date',
            'id_expiry_date' => 'nullable|date',
            'id_front_path' => 'required|file|mimes:jpg,jpeg,png,pdf|max:5120',
            'id_back_path' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:5120',
            'selfie_path' => 'required|file|mimes:jpg,jpeg,png|max:5120',
            'live_photo_path' => 'nullable|file|mimes:jpg,jpeg,png|max:5120',
            'address_proof_path' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:5120',
            'address' => 'required|string',
            'city' => 'required|string|max:100',
            'state' => 'required|string|max:100',
            'country' => 'required|string|max:100',
            'postal_code' => 'nullable|string|max:20',
            'nationality' => 'required|string|max:100',
            'date_of_birth' => 'required|date',
            'place_of_birth' => 'nullable|string|max:100',
            'additional_info' => 'nullable|string',
            'consent_data_processing' => 'required|boolean|accepted',
            'consent_identity_verification' => 'required|boolean|accepted',
        ]);

        // Check if user already has pending or approved KYC
        $existingKYC = KYCSubmission::where('user_id', $request->user()->id)
            ->whereIn('status', ['PENDING', 'UNDER_REVIEW', 'APPROVED'])
            ->first();

        if ($existingKYC) {
            return response()->json([
                'message' => 'You already have a KYC submission in progress or approved.'
            ], 400);
        }

        // Upload files
        $files = [];
        if ($request->hasFile('id_front_path')) {
            $files['id_front_path'] = $request->file('id_front_path')->store('kyc/id_documents', 'private');
        }
        if ($request->hasFile('id_back_path')) {
            $files['id_back_path'] = $request->file('id_back_path')->store('kyc/id_documents', 'private');
        }
        if ($request->hasFile('selfie_path')) {
            $files['selfie_path'] = $request->file('selfie_path')->store('kyc/selfies', 'private');
        }
        if ($request->hasFile('live_photo_path')) {
            $files['live_photo_path'] = $request->file('live_photo_path')->store('kyc/live_photos', 'private');
        }
        if ($request->hasFile('address_proof_path')) {
            $files['address_proof_path'] = $request->file('address_proof_path')->store('kyc/address_proofs', 'private');
        }

        // Create KYC submission
        $kyc = KYCSubmission::create([
            'user_id' => $request->user()->id,
            'id_type' => $validated['id_type'],
            'id_number' => $validated['id_number'],
            'id_issue_date' => $validated['id_issue_date'] ?? null,
            'id_expiry_date' => $validated['id_expiry_date'] ?? null,
            'id_front_path' => $files['id_front_path'] ?? null,
            'id_back_path' => $files['id_back_path'] ?? null,
            'selfie_path' => $files['selfie_path'] ?? null,
            'live_photo_path' => $files['live_photo_path'] ?? null,
            'address_proof_path' => $files['address_proof_path'] ?? null,
            'address' => $validated['address'],
            'city' => $validated['city'],
            'state' => $validated['state'],
            'country' => $validated['country'],
            'postal_code' => $validated['postal_code'] ?? null,
            'nationality' => $validated['nationality'],
            'date_of_birth' => $validated['date_of_birth'],
            'place_of_birth' => $validated['place_of_birth'] ?? null,
            'additional_info' => $validated['additional_info'] ?? null,
            'consent_data_processing' => $validated['consent_data_processing'],
            'consent_identity_verification' => $validated['consent_identity_verification'],
            'status' => 'PENDING',
            'files' => $files,
        ]);

        ActivityLog::log('KYC_SUBMITTED', $request->user()->id, 'KYC documents submitted', [
            'kyc_id' => $kyc->id,
        ]);

        // Dispatch processing jobs
        ProcessDocumentQuality::dispatch($kyc);
        ProcessKYCOCR::dispatch($kyc);
        ProcessFaceMatch::dispatch($kyc);

        return response()->json([
            'message' => 'KYC documents submitted successfully. We will review your submission.',
            'kyc' => $kyc
        ], 201);
    }

    /**
     * Update KYC status (Admin only)
     */
    public function updateStatus(Request $request, $id)
    {
        $validated = $request->validate([
            'status' => 'required|in:PENDING,UNDER_REVIEW,APPROVED,REJECTED,EXPIRED',
            'remarks' => 'nullable|string',
            'rejection_reason' => 'required_if:status,REJECTED|string',
        ]);

        $kyc = KYCSubmission::findOrFail($id);

        if ($validated['status'] === 'APPROVED') {
            $kyc->approve($request->user()->id, $validated['remarks'] ?? null);

            // Send approval email (queued)
            Mail::to($kyc->user->email)->queue(new KYCStatusEmail($kyc, 'APPROVED'));

            ActivityLog::log('KYC_APPROVED', $request->user()->id, 'KYC approved', [
                'kyc_id' => $kyc->id,
                'user_id' => $kyc->user_id,
            ]);

        } elseif ($validated['status'] === 'REJECTED') {
            $kyc->reject($request->user()->id, $validated['rejection_reason']);

            // Send rejection email (queued)
            Mail::to($kyc->user->email)->queue(new KYCStatusEmail($kyc, 'REJECTED', $validated['rejection_reason']));

            ActivityLog::log('KYC_REJECTED', $request->user()->id, 'KYC rejected', [
                'kyc_id' => $kyc->id,
                'user_id' => $kyc->user_id,
                'reason' => $validated['rejection_reason'],
            ]);

        } else {
            $kyc->update([
                'status' => $validated['status'],
                'reviewer_remarks' => $validated['remarks'] ?? null,
            ]);

            ActivityLog::log('KYC_STATUS_UPDATED', $request->user()->id, 'KYC status updated', [
                'kyc_id' => $kyc->id,
                'status' => $validated['status'],
            ]);
        }

        return response()->json([
            'message' => 'KYC status updated successfully.',
            'kyc' => $kyc
        ]);
    }

    /**
     * Get all KYC submissions (Admin only)
     */
    public function index(Request $request)
    {
        $query = KYCSubmission::with(['user', 'reviewer']);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Search by user
        if ($request->has('search')) {
            $search = $request->search;
            $query->whereHas('user', function($q) use ($search) {
                $q->where('first_name', 'LIKE', "%{$search}%")
                  ->orWhere('last_name', 'LIKE', "%{$search}%")
                  ->orWhere('email', 'LIKE', "%{$search}%");
            });
        }

        $kycs = $query->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($kycs);
    }

    /**
     * Get single KYC submission (Admin only)
     */
    public function adminShow($id)
    {
        $kyc = KYCSubmission::with([
            'user',
            'reviewer',
            'auditLogs.reviewer',
            'faceMatches',
            'ocrResults'
        ])->findOrFail($id);

        return response()->json($kyc);
    }

    /**
     * Get pending KYC count (Admin only)
     */
    public function pendingCount()
    {
        $count = KYCSubmission::whereIn('status', ['PENDING', 'UNDER_REVIEW'])->count();

        return response()->json(['count' => $count]);
    }
}
