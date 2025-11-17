<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ChatMessage extends Model
{
    use HasFactory;

    protected $fillable = [
        'thread_id',
        'sender_id',
        'message',
        'attachments',
    ];

    protected $casts = [
        'attachments' => 'array',
    ];

    // Relationships
    public function thread()
    {
        return $this->belongsTo(ChatThread::class, 'thread_id');
    }

    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function hides()
    {
        return $this->hasMany(ChatMessageHide::class, 'message_id');
    }

    // Helper methods
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

    // Scopes
    public function scopeInThread($query, $threadId)
    {
        return $query->where('thread_id', $threadId);
    }

    public function scopeBySender($query, $senderId)
    {
        return $query->where('sender_id', $senderId);
    }

    public function scopeNotHiddenFor($query, $userId)
    {
        return $query->whereDoesntHave('hides', function ($q) use ($userId) {
            $q->where('user_id', $userId);
        });
    }
}
