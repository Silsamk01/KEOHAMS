<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Affiliate extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'referral_code',
        'parent_affiliate_id',
        'total_earnings',
        'available_balance',
        'pending_balance',
        'direct_referrals',
        'total_downline',
        'total_clicks',
        'total_conversions',
        'conversion_rate',
        'is_active',
    ];

    protected $casts = [
        'total_earnings' => 'decimal:2',
        'available_balance' => 'decimal:2',
        'pending_balance' => 'decimal:2',
        'direct_referrals' => 'integer',
        'total_downline' => 'integer',
        'total_clicks' => 'integer',
        'total_conversions' => 'integer',
        'conversion_rate' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    // Relationships
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function parent()
    {
        return $this->belongsTo(Affiliate::class, 'parent_affiliate_id');
    }

    public function children()
    {
        return $this->hasMany(Affiliate::class, 'parent_affiliate_id');
    }

    public function sales()
    {
        return $this->hasMany(AffiliateSale::class);
    }

    public function commissions()
    {
        return $this->hasMany(CommissionRecord::class);
    }

    public function withdrawals()
    {
        return $this->hasMany(AffiliateWithdrawal::class);
    }

    public function clicks()
    {
        return $this->hasMany(AffiliateClick::class);
    }

    public function conversions()
    {
        return $this->hasMany(AffiliateConversion::class);
    }

    public function customCommissionRates()
    {
        return $this->hasMany(CustomCommissionRate::class);
    }

    // Helper methods
    public function getLevel()
    {
        $level = 0;
        $parent = $this->parent;
        
        while ($parent) {
            $level++;
            $parent = $parent->parent;
        }
        
        return $level;
    }

    public function getAllAncestors()
    {
        $ancestors = collect();
        $parent = $this->parent;
        
        while ($parent) {
            $ancestors->push($parent);
            $parent = $parent->parent;
        }
        
        return $ancestors;
    }

    public function calculateConversionRate()
    {
        if ($this->total_clicks == 0) {
            return 0;
        }
        
        $rate = ($this->total_conversions / $this->total_clicks) * 100;
        $this->update(['conversion_rate' => round($rate, 2)]);
        
        return $rate;
    }

    public function addEarnings($amount, $type = 'pending')
    {
        if ($type === 'pending') {
            $this->increment('pending_balance', $amount);
        } else {
            $this->increment('available_balance', $amount);
        }
        
        $this->increment('total_earnings', $amount);
    }

    public function releasePendingBalance($amount)
    {
        $this->decrement('pending_balance', $amount);
        $this->increment('available_balance', $amount);
    }

    public function deductBalance($amount)
    {
        $this->decrement('available_balance', $amount);
    }
}
