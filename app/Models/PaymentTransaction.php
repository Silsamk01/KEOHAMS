<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PaymentTransaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'order_id',
        'quotation_id',
        'reference',
        'amount',
        'currency',
        'status',
        'payment_method',
        'paystack_reference',
        'authorization_code',
        'card_type',
        'card_last4',
        'bank',
        'channel',
        'customer_email',
        'customer_name',
        'ip_address',
        'metadata',
        'error_message',
        'paid_at',
        'verified_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'metadata' => 'array',
        'paid_at' => 'datetime',
        'verified_at' => 'datetime',
    ];

    // Relationships
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function quotation()
    {
        return $this->belongsTo(Quotation::class);
    }

    public function refunds()
    {
        return $this->hasMany(PaymentRefund::class, 'transaction_id');
    }

    // Accessors
    public function getIsSuccessfulAttribute()
    {
        return $this->status === 'SUCCESS';
    }

    public function getIsRefundedAttribute()
    {
        return in_array($this->status, ['REFUNDED', 'PARTIALLY_REFUNDED']);
    }

    public function getTotalRefundedAttribute()
    {
        return $this->refunds()->where('status', 'SUCCESS')->sum('amount');
    }

    public function getFormattedAmountAttribute()
    {
        return $this->currency . ' ' . number_format($this->amount, 2);
    }

    // Scopes
    public function scopeSuccessful($query)
    {
        return $query->where('status', 'SUCCESS');
    }

    public function scopeFailed($query)
    {
        return $query->where('status', 'FAILED');
    }

    public function scopeByUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    // Helper methods
    public function markAsSuccess($paystackData = [])
    {
        $this->update([
            'status' => 'SUCCESS',
            'paid_at' => now(),
            'verified_at' => now(),
            'paystack_reference' => $paystackData['reference'] ?? null,
            'authorization_code' => $paystackData['authorization_code'] ?? null,
            'card_type' => $paystackData['card_type'] ?? null,
            'card_last4' => $paystackData['card_last4'] ?? null,
            'bank' => $paystackData['bank'] ?? null,
            'channel' => $paystackData['channel'] ?? null,
        ]);

        // Update related order or quotation
        if ($this->order_id) {
            $this->order->markAsPaid($this->id);
        } elseif ($this->quotation_id) {
            $this->quotation->markAsPaid($this->id);
        }
    }

    public function markAsFailed($errorMessage = null)
    {
        $this->update([
            'status' => 'FAILED',
            'error_message' => $errorMessage,
        ]);
    }

    public function initiateRefund($amount, $reason, $initiatedBy = null, $notes = null)
    {
        return $this->refunds()->create([
            'refund_reference' => 'RF-' . strtoupper(substr(md5(uniqid(mt_rand(), true)), 0, 10)),
            'amount' => $amount,
            'currency' => $this->currency,
            'reason' => $reason,
            'notes' => $notes,
            'initiated_by' => $initiatedBy,
        ]);
    }

    public static function generateReference()
    {
        return 'TXN-' . strtoupper(substr(md5(uniqid(mt_rand(), true)), 0, 12));
    }
}
