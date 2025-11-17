<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SecurityAlertEmail extends Mailable
{
    use Queueable, SerializesModels;

    public User $user;
    public string $alertType;
    public array $details;

    /**
     * Create a new message instance.
     */
    public function __construct(User $user, string $alertType, array $details = [])
    {
        $this->user = $user;
        $this->alertType = $alertType;
        $this->details = $details;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '🚨 Security Alert: ' . $this->alertType,
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.security-alert',
            with: [
                'user' => $this->user,
                'alertType' => $this->alertType,
                'details' => $this->details,
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
