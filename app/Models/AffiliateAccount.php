<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class AffiliateAccount extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'email',
        'password',
        'first_name',
        'last_name',
        'phone',
        'company_name',
        'address',
        'city',
        'state',
        'country',
        'referral_code',
        'parent_affiliate_id',
        'status',
        'email_verified',
        'verification_token',
        'total_earnings',
        'available_balance',
        'pending_balance',
        'direct_referrals',
        'total_downline',
        'total_clicks',
        'total_conversions',
        'conversion_rate',
        'bank_name',
        'account_number',
        'account_name',
        'payment_details',
        'token_version',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'verification_token',
    ];

    protected $casts = [
        'email_verified' => 'boolean',
        'email_verified_at' => 'datetime',
        'total_earnings' => 'decimal:2',
        'available_balance' => 'decimal:2',
        'pending_balance' => 'decimal:2',
        'direct_referrals' => 'integer',
        'total_downline' => 'integer',
        'total_clicks' => 'integer',
        'total_conversions' => 'integer',
        'conversion_rate' => 'decimal:2',
        'payment_details' => 'array',
        'token_version' => 'integer',
        'deleted_at' => 'datetime',
    ];

    // Relationships
    public function parent()
    {
        return $this->belongsTo(AffiliateAccount::class, 'parent_affiliate_id');
    }

    public function children()
    {
        return $this->hasMany(AffiliateAccount::class, 'parent_affiliate_id');
    }

    public function sales()
    {
        return $this->hasMany(AffiliateSale::class, 'affiliate_account_id');
    }

    public function commissions()
    {
        return $this->hasMany(CommissionRecord::class, 'affiliate_account_id');
    }

    public function withdrawals()
    {
        return $this->hasMany(AffiliateWithdrawal::class, 'affiliate_account_id');
    }

    public function clicks()
    {
        return $this->hasMany(AffiliateClick::class, 'affiliate_account_id');
    }

    public function conversions()
    {
        return $this->hasMany(AffiliateConversion::class, 'affiliate_account_id');
    }

    public function verificationTokens()
    {
        return $this->hasMany(AffiliateVerificationToken::class);
    }

    // Accessors
    public function getFullNameAttribute()
    {
        return "{$this->first_name} {$this->last_name}";
    }

    public function getIsActiveAttribute()
    {
        return $this->status === 'ACTIVE';
    }

    public function getIsPendingAttribute()
    {
        return $this->status === 'PENDING';
    }

    // Mutators
    public function setPasswordAttribute($value)
    {
        $this->attributes['password'] = bcrypt($value);
    }

    // Helper methods
    public function incrementTokenVersion()
    {
        $this->increment('token_version');
    }

    public function approve()
    {
        $this->update(['status' => 'ACTIVE']);
    }

    public function suspend()
    {
        $this->update(['status' => 'SUSPENDED']);
    }

    public function reject()
    {
        $this->update(['status' => 'REJECTED']);
    }
}
