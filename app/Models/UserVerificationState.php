<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserVerificationState extends Model
{
    protected $table = 'user_verification_state';
    
    protected $fillable = [
        'user_id', 'status', 'risk_score', 'risk_level', 'manual_lock', 'lock_reason', 'locked_at'
    ];

    protected $casts = [
        'risk_score' => 'integer',
        'manual_lock' => 'boolean',
        'locked_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function riskEvents()
    {
        return $this->hasMany(RiskEvent::class, 'user_id', 'user_id');
    }
}
