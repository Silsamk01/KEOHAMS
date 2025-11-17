<?php

namespace App\Mail;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OrderStatusEmail extends Mailable
{
    use Queueable, SerializesModels;

    public Order $order;
    public string $newStatus;
    public ?string $trackingNumber;

    /**
     * Create a new message instance.
     */
    public function __construct(Order $order, string $newStatus, ?string $trackingNumber = null)
    {
        $this->order = $order;
        $this->newStatus = $newStatus;
        $this->trackingNumber = $trackingNumber;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        $statusText = match($this->newStatus) {
            'PROCESSING' => 'is being processed',
            'SHIPPED' => 'has been shipped',
            'DELIVERED' => 'has been delivered',
            'CANCELLED' => 'has been cancelled',
            default => 'status has been updated',
        };

        return new Envelope(
            subject: "Order #{$this->order->order_number} {$statusText} - KEOHAMS",
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.order-status',
            with: [
                'order' => $this->order,
                'user' => $this->order->user,
                'newStatus' => $this->newStatus,
                'trackingNumber' => $this->trackingNumber,
                'orderUrl' => config('app.frontend_url') . '/orders/' . $this->order->id,
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
