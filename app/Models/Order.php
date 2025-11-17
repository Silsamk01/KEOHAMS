<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'order_number',
        'status',
        'subtotal_amount',
        'discount_amount',
        'tax_amount',
        'total_amount',
        'currency',
        'payment_method',
        'payment_transaction_id',
        'payment_status',
        'paid_at',
        'shipping_address',
        'billing_address',
        'shipping_method',
        'shipping_cost',
        'tracking_number',
        'carrier',
        'estimated_delivery_date',
        'shipped_at',
        'delivered_at',
        'cancellation_reason',
        'cancelled_at',
        'cancelled_by',
        'admin_notes',
        'customer_notes',
    ];

    protected $casts = [
        'subtotal_amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'shipping_cost' => 'decimal:2',
        'shipping_address' => 'array',
        'billing_address' => 'array',
        'paid_at' => 'datetime',
        'shipped_at' => 'datetime',
        'delivered_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    // Relationships
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function paymentTransaction()
    {
        return $this->belongsTo(PaymentTransaction::class);
    }

    public function statusHistory()
    {
        return $this->hasMany(OrderStatusHistory::class);
    }

    public function shipments()
    {
        return $this->hasMany(OrderShipment::class);
    }

    public function returns()
    {
        return $this->hasMany(OrderReturn::class);
    }

    public function invoices()
    {
        return $this->hasMany(OrderInvoice::class);
    }

    public function notes()
    {
        return $this->hasMany(OrderNote::class);
    }

    public function cancelledBy()
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    // Accessors
    public function getIsPaidAttribute()
    {
        return $this->payment_status === 'PAID';
    }

    public function getIsDeliveredAttribute()
    {
        return $this->status === 'DELIVERED';
    }

    public function getIsCancelledAttribute()
    {
        return $this->status === 'CANCELLED';
    }

    public function getCanBeCancelledAttribute()
    {
        return in_array($this->status, ['PENDING', 'AWAITING_PAYMENT', 'PAID', 'PROCESSING']);
    }

    public function getFormattedTotalAttribute()
    {
        return $this->currency . ' ' . number_format($this->total_amount, 2);
    }

    // Scopes
    public function scopePending($query)
    {
        return $query->where('status', 'PENDING');
    }

    public function scopePaid($query)
    {
        return $query->where('payment_status', 'PAID');
    }

    public function scopeDelivered($query)
    {
        return $query->where('status', 'DELIVERED');
    }

    public function scopeByUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    // Helper methods
    public function updateStatus($newStatus, $changedBy = null, $notes = null)
    {
        $oldStatus = $this->status;
        $this->status = $newStatus;
        $this->save();

        // Log status change
        $this->statusHistory()->create([
            'from_status' => $oldStatus,
            'to_status' => $newStatus,
            'changed_by' => $changedBy,
            'changed_by_type' => $changedBy ? 'ADMIN' : 'SYSTEM',
            'notes' => $notes,
        ]);
    }

    public function calculateTotals()
    {
        $subtotal = $this->items()->sum('line_total');
        
        $this->update([
            'subtotal_amount' => $subtotal,
            'total_amount' => $subtotal - $this->discount_amount + $this->tax_amount + $this->shipping_cost,
        ]);
    }

    public function markAsPaid($transactionId = null)
    {
        $this->update([
            'payment_status' => 'PAID',
            'payment_transaction_id' => $transactionId,
            'paid_at' => now(),
        ]);

        $this->updateStatus('PAID', null, 'Payment confirmed');
    }

    public function ship($trackingNumber, $carrier, $shipmentReference = null)
    {
        $this->update([
            'status' => 'SHIPPED',
            'tracking_number' => $trackingNumber,
            'carrier' => $carrier,
            'shipped_at' => now(),
        ]);

        $this->updateStatus('SHIPPED', null, "Shipped via {$carrier}");
    }

    public function deliver()
    {
        $this->update([
            'status' => 'DELIVERED',
            'delivered_at' => now(),
        ]);

        $this->updateStatus('DELIVERED');
    }

    public function cancel($reason, $cancelledBy = null)
    {
        $this->update([
            'status' => 'CANCELLED',
            'cancellation_reason' => $reason,
            'cancelled_at' => now(),
            'cancelled_by' => $cancelledBy,
        ]);

        $this->updateStatus('CANCELLED', $cancelledBy, $reason);

        // Restore stock for all items
        foreach ($this->items as $item) {
            $item->product->incrementStock($item->quantity);
        }
    }
}
