<?php

namespace App\Mail;

use App\Models\KYCSubmission;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class KYCStatusEmail extends Mailable
{
    use Queueable, SerializesModels;

    public KYCSubmission $kycSubmission;
    public string $status;
    public ?string $rejectionReason;

    /**
     * Create a new message instance.
     */
    public function __construct(KYCSubmission $kycSubmission, string $status, ?string $rejectionReason = null)
    {
        $this->kycSubmission = $kycSubmission;
        $this->status = $status;
        $this->rejectionReason = $rejectionReason;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        $subject = $this->status === 'APPROVED' 
            ? 'KYC Verification Approved - KEOHAMS'
            : 'KYC Verification Update - KEOHAMS';

        return new Envelope(
            subject: $subject,
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.kyc-status',
            with: [
                'user' => $this->kycSubmission->user,
                'status' => $this->status,
                'rejectionReason' => $this->rejectionReason,
                'submittedAt' => $this->kycSubmission->submitted_at?->format('M d, Y'),
                'reviewedAt' => $this->kycSubmission->reviewed_at?->format('M d, Y'),
                'dashboardUrl' => config('app.frontend_url') . '/dashboard',
            ],
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, \Illuminate\Mail\Mailables\Attachment>
     */
    public function attachments(): array
    {
        return [];
    }
}
