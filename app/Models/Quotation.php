<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Quotation extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'reference',
        'status',
        'subtotal_amount',
        'logistics_amount',
        'discount_amount',
        'total_amount',
        'currency',
        'allowed_payment_methods',
        'customer_notes',
        'admin_notes',
        'replied_at',
        'paid_at',
        'payment_transaction_id',
        'payment_status',
    ];

    protected $casts = [
        'subtotal_amount' => 'decimal:2',
        'logistics_amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'replied_at' => 'datetime',
        'paid_at' => 'datetime',
    ];

    // Relationships
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function items()
    {
        return $this->hasMany(QuotationItem::class);
    }

    public function paymentTransaction()
    {
        return $this->belongsTo(PaymentTransaction::class);
    }

    // Accessors
    public function getIsRequestedAttribute()
    {
        return $this->status === 'REQUESTED';
    }

    public function getIsRepliedAttribute()
    {
        return $this->status === 'REPLIED';
    }

    public function getIsPaidAttribute()
    {
        return $this->status === 'PAID';
    }

    public function getFormattedTotalAttribute()
    {
        return $this->currency . ' ' . number_format($this->total_amount, 2);
    }

    public function getAllowedPaymentMethodsArrayAttribute()
    {
        return $this->allowed_payment_methods ? explode(',', $this->allowed_payment_methods) : [];
    }

    // Scopes
    public function scopeRequested($query)
    {
        return $query->where('status', 'REQUESTED');
    }

    public function scopeReplied($query)
    {
        return $query->where('status', 'REPLIED');
    }

    public function scopePaid($query)
    {
        return $query->where('status', 'PAID');
    }

    public function scopeByUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    // Helper methods
    public function reply($pricing, $adminNotes = null)
    {
        $this->update([
            'status' => 'REPLIED',
            'subtotal_amount' => $pricing['subtotal'] ?? 0,
            'logistics_amount' => $pricing['logistics'] ?? 0,
            'discount_amount' => $pricing['discount'] ?? 0,
            'total_amount' => $pricing['total'] ?? 0,
            'allowed_payment_methods' => $pricing['payment_methods'] ?? null,
            'admin_notes' => $adminNotes,
            'replied_at' => now(),
        ]);
    }

    public function markAsPaid($transactionId = null)
    {
        $this->update([
            'status' => 'PAID',
            'payment_status' => 'PAID',
            'payment_transaction_id' => $transactionId,
            'paid_at' => now(),
        ]);
    }

    public function cancel()
    {
        $this->update([
            'status' => 'CANCELLED',
        ]);
    }

    public function calculateTotals()
    {
        $subtotal = $this->items()->sum('line_total');
        
        $total = $subtotal + $this->logistics_amount - $this->discount_amount;
        
        $this->update([
            'subtotal_amount' => $subtotal,
            'total_amount' => $total,
        ]);
    }

    public static function generateReference()
    {
        return 'QT-' . strtoupper(substr(md5(uniqid(mt_rand(), true)), 0, 10));
    }
}
