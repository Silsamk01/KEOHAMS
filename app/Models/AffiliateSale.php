<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AffiliateSale extends Model
{
    protected $fillable = [
        'affiliate_id', 'affiliate_account_id', 'customer_id', 'sale_reference', 'sale_amount',
        'payment_method', 'payment_details', 'verification_status', 'verified_by', 'verified_at',
        'verification_notes', 'commissions_paid', 'commissions_paid_at'
    ];

    protected $casts = [
        'sale_amount' => 'decimal:2',
        'verified_at' => 'datetime',
        'commissions_paid' => 'boolean',
        'commissions_paid_at' => 'datetime',
    ];

    public function affiliate()
    {
        return $this->belongsTo(Affiliate::class);
    }

    public function affiliateAccount()
    {
        return $this->belongsTo(AffiliateAccount::class);
    }

    public function customer()
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function commissions()
    {
        return $this->hasMany(CommissionRecord::class, 'sale_id');
    }
}

class CommissionRecord extends Model
{
    protected $fillable = [
        'sale_id', 'affiliate_id', 'affiliate_account_id', 'level', 'commission_rate',
        'commission_amount', 'status', 'paid_at'
    ];

    protected $casts = [
        'level' => 'integer',
        'commission_rate' => 'decimal:2',
        'commission_amount' => 'decimal:2',
        'paid_at' => 'datetime',
    ];

    public function sale()
    {
        return $this->belongsTo(AffiliateSale::class);
    }

    public function affiliate()
    {
        return $this->belongsTo(Affiliate::class);
    }

    public function affiliateAccount()
    {
        return $this->belongsTo(AffiliateAccount::class);
    }
}

class AffiliateWithdrawal extends Model
{
    protected $fillable = [
        'affiliate_id', 'affiliate_account_id', 'amount', 'method', 'payment_details',
        'status', 'processed_by', 'processed_at', 'processing_notes', 'transaction_reference'
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'payment_details' => 'array',
        'processed_at' => 'datetime',
    ];

    public function affiliate()
    {
        return $this->belongsTo(Affiliate::class);
    }

    public function affiliateAccount()
    {
        return $this->belongsTo(AffiliateAccount::class);
    }
}
