<?php

namespace App\Mail;

use App\Models\AffiliateAccount;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AffiliateApprovedEmail extends Mailable
{
    use Queueable, SerializesModels;

    public AffiliateAccount $affiliate;

    /**
     * Create a new message instance.
     */
    public function __construct(AffiliateAccount $affiliate)
    {
        $this->affiliate = $affiliate;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Your Affiliate Account Has Been Approved - KEOHAMS',
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        $referralLink = config('app.frontend_url') . '?ref=' . $this->affiliate->referral_code;

        return new Content(
            view: 'emails.affiliate-approved',
            with: [
                'affiliate' => $this->affiliate,
                'referralCode' => $this->affiliate->referral_code,
                'referralLink' => $referralLink,
                'dashboardUrl' => config('app.frontend_url') . '/affiliate/dashboard',
                'approvedAt' => $this->affiliate->updated_at->format('M d, Y h:i A'),
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
