<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SupportTicket extends Model
{
    protected $fillable = [
        'ticket_number', 'user_id', 'category', 'subject', 'description', 'priority',
        'status', 'assigned_to', 'resolved_at', 'closed_at'
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
        'closed_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function assignedTo()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function messages()
    {
        return $this->hasMany(TicketMessage::class, 'ticket_id');
    }

    public function scopeOpen($query)
    {
        return $query->whereIn('status', ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_ADMIN']);
    }

    public function scopeClosed($query)
    {
        return $query->whereIn('status', ['RESOLVED', 'CLOSED']);
    }
}

class TicketMessage extends Model
{
    protected $fillable = ['ticket_id', 'user_id', 'message', 'is_admin', 'is_internal_note', 'attachments'];

    protected $casts = [
        'is_admin' => 'boolean',
        'is_internal_note' => 'boolean',
        'attachments' => 'array',
    ];

    public function ticket()
    {
        return $this->belongsTo(SupportTicket::class, 'ticket_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
