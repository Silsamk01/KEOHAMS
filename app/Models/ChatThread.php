<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ChatThread extends Model
{
    use HasFactory;

    protected $fillable = [
        'subject',
        'status',
    ];

    // Relationships
    public function participants()
    {
        return $this->belongsToMany(User::class, 'chat_thread_participants')
            ->withTimestamps();
    }

    public function messages()
    {
        return $this->hasMany(ChatMessage::class, 'thread_id');
    }

    public function hides()
    {
        return $this->hasMany(ChatThreadHide::class, 'thread_id');
    }

    // Helper methods
    public function getLastMessage()
    {
        return $this->messages()->latest()->first();
    }

    public function isHiddenFor($userId)
    {
        return $this->hides()->where('user_id', $userId)->exists();
    }

    public function hideFor($userId)
    {
        return $this->hides()->firstOrCreate(['user_id' => $userId]);
    }

    public function unhideFor($userId)
    {
        return $this->hides()->where('user_id', $userId)->delete();
    }

    public function addMessage($senderId, $message, $attachments = null)
    {
        return $this->messages()->create([
            'sender_id' => $senderId,
            'message' => $message,
            'attachments' => $attachments,
        ]);
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('status', 'ACTIVE');
    }

    public function scopeClosed($query)
    {
        return $query->where('status', 'CLOSED');
    }

    public function scopeForUser($query, $userId)
    {
        return $query->whereHas('participants', function ($q) use ($userId) {
            $q->where('users.id', $userId);
        });
    }

    public function scopeNotHiddenFor($query, $userId)
    {
        return $query->whereDoesntHave('hides', function ($q) use ($userId) {
            $q->where('user_id', $userId);
        });
    }
}
