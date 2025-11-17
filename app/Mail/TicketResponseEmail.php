<?php

namespace App\Mail;

use App\Models\SupportTicket;
use App\Models\TicketMessage;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class TicketResponseEmail extends Mailable
{
    use Queueable, SerializesModels;

    public SupportTicket $ticket;
    public TicketMessage $message;

    /**
     * Create a new message instance.
     */
    public function __construct(SupportTicket $ticket, TicketMessage $message)
    {
        $this->ticket = $ticket;
        $this->message = $message;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "New Response to Ticket #{$this->ticket->id} - KEOHAMS Support",
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.ticket-response',
            with: [
                'ticket' => $this->ticket,
                'message' => $this->message,
                'user' => $this->ticket->user,
                'ticketUrl' => config('app.frontend_url') . '/support/tickets/' . $this->ticket->id,
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
