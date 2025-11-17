<?php

namespace App\Http\Controllers;

use App\Models\ChatThread;
use App\Models\ChatMessage;
use App\Models\User;
use App\Models\ActivityLog;
use App\Events\MessageSent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ChatController extends Controller
{
    /**
     * Get all chat threads for authenticated user
     */
    public function threads(Request $request)
    {
        $userId = $request->user()->id;

        $threads = ChatThread::with([
            'participants',
            'messages' => function($query) {
                $query->latest()->limit(1);
            }
        ])
        ->forUser($userId)
        ->notHiddenFor($userId)
        ->orderBy('updated_at', 'desc')
        ->paginate(20);

        return response()->json($threads);
    }

    /**
     * Get or create thread with specific user
     */
    public function getOrCreateThread(Request $request)
    {
        $validated = $request->validate([
            'participant_id' => 'required|exists:users,id',
        ]);

        $currentUserId = $request->user()->id;
        $participantId = $validated['participant_id'];

        // Check if thread already exists between these users
        $thread = ChatThread::whereHas('participants', function($query) use ($currentUserId) {
            $query->where('user_id', $currentUserId);
        })
        ->whereHas('participants', function($query) use ($participantId) {
            $query->where('user_id', $participantId);
        })
        ->whereDoesntHave('participants', function($query) use ($currentUserId, $participantId) {
            $query->whereNotIn('user_id', [$currentUserId, $participantId]);
        })
        ->first();

        // Create new thread if doesn't exist
        if (!$thread) {
            DB::beginTransaction();
            try {
                $thread = ChatThread::create([
                    'type' => 'DIRECT',
                    'status' => 'ACTIVE',
                ]);

                $thread->participants()->attach([$currentUserId, $participantId]);

                DB::commit();

                ActivityLog::log('CHAT_THREAD_CREATED', $currentUserId, 'Chat thread created', [
                    'thread_id' => $thread->id,
                ]);
            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }
        }

        return response()->json($thread->load('participants'));
    }

    /**
     * Get messages in a thread
     */
    public function messages(Request $request, $threadId)
    {
        $thread = ChatThread::findOrFail($threadId);
        $userId = $request->user()->id;

        // Check if user is participant
        if (!$thread->participants->contains($userId)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $messages = $thread->messages()
            ->with('sender')
            ->where(function($query) use ($userId) {
                $query->whereDoesntHave('hides', function($q) use ($userId) {
                    $q->where('user_id', $userId);
                });
            })
            ->orderBy('created_at', 'asc')
            ->paginate(50);

        // Mark messages as read
        $thread->messages()
            ->where('sender_id', '!=', $userId)
            ->where('read_at', null)
            ->update(['read_at' => now()]);

        return response()->json($messages);
    }

    /**
     * Send message
     */
    public function sendMessage(Request $request, $threadId)
    {
        $validated = $request->validate([
            'message' => 'required|string',
            'attachments' => 'nullable|array',
        ]);

        $thread = ChatThread::findOrFail($threadId);
        $userId = $request->user()->id;

        // Check if user is participant
        if (!$thread->participants->contains($userId)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        // Check if thread is closed
        if ($thread->status === 'CLOSED') {
            return response()->json(['message' => 'Cannot send message to closed thread.'], 400);
        }

        $message = ChatMessage::create([
            'thread_id' => $thread->id,
            'sender_id' => $userId,
            'message' => $validated['message'],
            'attachments' => $validated['attachments'] ?? null,
        ]);

        // Update thread timestamp
        $thread->touch();

        // Broadcast message via WebSocket
        broadcast(new MessageSent($message))->toOthers();

        ActivityLog::log('CHAT_MESSAGE_SENT', $userId, 'Chat message sent', [
            'thread_id' => $thread->id,
            'message_id' => $message->id,
        ]);

        return response()->json([
            'message' => 'Message sent successfully.',
            'data' => $message->load('sender')
        ], 201);
    }

    /**
     * Delete message (hide for user)
     */
    public function deleteMessage(Request $request, $messageId)
    {
        $message = ChatMessage::findOrFail($messageId);
        $userId = $request->user()->id;

        // Check if user is sender
        if ($message->sender_id !== $userId) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $message->hideFor($userId);

        return response()->json(['message' => 'Message deleted.']);
    }

    /**
     * Hide thread
     */
    public function hideThread(Request $request, $threadId)
    {
        $thread = ChatThread::findOrFail($threadId);
        $userId = $request->user()->id;

        // Check if user is participant
        if (!$thread->participants->contains($userId)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $thread->hideFor($userId);

        return response()->json(['message' => 'Thread hidden.']);
    }

    /**
     * Get unread message count
     */
    public function unreadCount(Request $request)
    {
        $userId = $request->user()->id;

        $count = ChatMessage::whereHas('thread', function($query) use ($userId) {
            $query->forUser($userId);
        })
        ->where('sender_id', '!=', $userId)
        ->whereNull('read_at')
        ->count();

        return response()->json(['count' => $count]);
    }

    /**
     * Admin: Get all threads
     */
    public function adminIndex(Request $request)
    {
        $query = ChatThread::with([
            'participants',
            'messages' => function($query) {
                $query->latest()->limit(1);
            }
        ]);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $threads = $query->orderBy('updated_at', 'desc')
            ->paginate(20);

        return response()->json($threads);
    }

    /**
     * Admin: Close thread
     */
    public function closeThread(Request $request, $threadId)
    {
        $thread = ChatThread::findOrFail($threadId);

        $thread->update(['status' => 'CLOSED']);

        ActivityLog::log('CHAT_THREAD_CLOSED', $request->user()->id, 'Chat thread closed', [
            'thread_id' => $thread->id,
        ]);

        return response()->json([
            'message' => 'Thread closed successfully.',
            'thread' => $thread
        ]);
    }
}
