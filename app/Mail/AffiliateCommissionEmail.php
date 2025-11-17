<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AffiliateCommissionEmail extends Mailable
{
    use Queueable, SerializesModels;

    public $affiliate;
    public $commission;

    /**
     * Create a new message instance.
     */
    public function __construct($affiliate, $commission)
    {
        $this->affiliate = $affiliate;
        $this->commission = $commission;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'New Commission Earned - ₦' . number_format($this->commission->amount, 2),
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.affiliate-commission',
            with: [
                'affiliate' => $this->affiliate,
                'commission' => $this->commission,
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
