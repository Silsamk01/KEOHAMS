<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SecurityEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'type',
        'ip_address',
        'user_id',
        'user_agent',
        'url',
        'method',
        'data',
        'severity',
    ];

    protected $casts = [
        'data' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the user associated with the security event
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Scope for high severity events
     */
    public function scopeHighSeverity($query)
    {
        return $query->where('severity', 'high');
    }

    /**
     * Scope for medium severity events
     */
    public function scopeMediumSeverity($query)
    {
        return $query->where('severity', 'medium');
    }

    /**
     * Scope for low severity events
     */
    public function scopeLowSeverity($query)
    {
        return $query->where('severity', 'low');
    }

    /**
     * Scope for recent events
     */
    public function scopeRecent($query, $days = 7)
    {
        return $query->where('created_at', '>=', now()->subDays($days));
    }

    /**
     * Scope for specific event type
     */
    public function scopeOfType($query, $type)
    {
        return $query->where('type', $type);
    }

    /**
     * Scope for specific IP
     */
    public function scopeFromIp($query, $ip)
    {
        return $query->where('ip_address', $ip);
    }

    /**
     * Get formatted severity badge
     */
    public function getSeverityBadgeAttribute()
    {
        $badges = [
            'high' => 'danger',
            'medium' => 'warning',
            'low' => 'info',
        ];

        return $badges[$this->severity] ?? 'secondary';
    }

    /**
     * Get formatted event type
     */
    public function getFormattedTypeAttribute()
    {
        return str_replace('_', ' ', ucwords(strtolower($this->type)));
    }
}
