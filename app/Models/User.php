<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'name',
        'email',
        'password',
        'phone',
        'address',
        'dob',
        'gender',
        'avatar_url',
        'referral_code',
    ];

    protected $guarded = [
        'role',
        'email_verified',
        'twofa_secret',
        'recovery_codes',
        'email_2fa_enabled',
        'email_2fa_method',
        'phone_verified',
        'token_version',
        'deleted_at',
    ];

    protected $hidden = [
        'password',
        'twofa_secret',
        'recovery_codes',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'phone_verified_at' => 'datetime',
        'email_verified' => 'boolean',
        'phone_verified' => 'boolean',
        'email_2fa_enabled' => 'boolean',
        'recovery_codes' => 'array',
        'dob' => 'date',
        'token_version' => 'integer',
        'deleted_at' => 'datetime',
    ];

    // Relationships
    public function kycSubmissions()
    {
        return $this->hasMany(KYCSubmission::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function quotations()
    {
        return $this->hasMany(Quotation::class);
    }

    public function notifications()
    {
        return $this->hasMany(Notification::class);
    }

    public function chatThreads()
    {
        return $this->belongsToMany(ChatThread::class, 'chat_thread_participants')
            ->withTimestamps();
    }

    public function sentMessages()
    {
        return $this->hasMany(ChatMessage::class, 'sender_id');
    }

    public function affiliate()
    {
        return $this->hasOne(Affiliate::class);
    }

    public function verificationState()
    {
        return $this->hasOne(UserVerificationState::class);
    }

    public function paymentTransactions()
    {
        return $this->hasMany(PaymentTransaction::class);
    }

    public function wishlists()
    {
        return $this->hasMany(Wishlist::class);
    }

    public function reviews()
    {
        return $this->hasMany(ProductReview::class);
    }

    public function supportTickets()
    {
        return $this->hasMany(SupportTicket::class);
    }

    public function activityLogs()
    {
        return $this->hasMany(ActivityLog::class);
    }

    // Accessors
    public function getAgeAttribute()
    {
        return $this->dob ? $this->dob->age : null;
    }

    public function getIsAdminAttribute()
    {
        return $this->role === 'ADMIN';
    }

    public function getHasTwoFactorAttribute()
    {
        return !empty($this->twofa_secret) || $this->email_2fa_enabled;
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

    public function isVerified()
    {
        return $this->verificationState && 
               in_array($this->verificationState->status, ['BASIC_VERIFIED', 'KYC_VERIFIED']);
    }

    public function hasKycVerified()
    {
        return $this->verificationState && 
               $this->verificationState->status === 'KYC_VERIFIED';
    }
}
