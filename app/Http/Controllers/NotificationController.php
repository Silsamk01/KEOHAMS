<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use App\Models\ActivityLog;
use App\Services\NotificationService;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    private NotificationService $notificationService;

    public function __construct(NotificationService $notificationService)
    {
        $this->notificationService = $notificationService;
    }
    /**
     * Get all notifications for authenticated user
     */
    public function index(Request $request)
    {
        $query = Notification::with('reads')
            ->where('user_id', $request->user()->id);

        // Filter by priority
        if ($request->has('priority')) {
            $query->byPriority($request->priority);
        }

        // Filter unread
        if ($request->has('unread') && $request->unread === 'true') {
            $query->unreadBy($request->user()->id);
        }

        $notifications = $query->orderBy('created_at', 'desc')
            ->paginate(50);

        return response()->json($notifications);
    }

    /**
     * Get unread count
     */
    public function unreadCount(Request $request)
    {
        $count = Notification::unreadBy($request->user()->id)->count();

        return response()->json(['count' => $count]);
    }

    /**
     * Mark notification as read
     */
    public function markAsRead(Request $request, $id)
    {
        $notification = Notification::findOrFail($id);

        if ($notification->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $notification->markAsReadBy($request->user()->id);

        return response()->json(['message' => 'Notification marked as read.']);
    }

    /**
     * Mark all notifications as read
     */
    public function markAllAsRead(Request $request)
    {
        $notifications = Notification::unreadBy($request->user()->id)->get();

        foreach ($notifications as $notification) {
            $notification->markAsReadBy($request->user()->id);
        }

        ActivityLog::log('NOTIFICATIONS_MARKED_READ', $request->user()->id, 'All notifications marked as read');

        return response()->json(['message' => 'All notifications marked as read.']);
    }

    /**
     * Delete notification
     */
    public function destroy(Request $request, $id)
    {
        $notification = Notification::findOrFail($id);

        if ($notification->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $notification->delete();

        return response()->json(['message' => 'Notification deleted.']);
    }

    /**
     * Send notification (Admin only)
     */
    public function send(Request $request)
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'title' => 'required|string|max:255',
            'message' => 'required|string',
            'type' => 'required|string|max:50',
            'priority' => 'required|in:LOW,MEDIUM,HIGH,URGENT',
            'channel' => 'required|in:IN_APP,EMAIL,SMS,PUSH',
            'action_url' => 'nullable|url',
            'data' => 'nullable|array',
        ]);

        $notification = Notification::create($validated);

        ActivityLog::log('NOTIFICATION_SENT', $request->user()->id, 'Notification sent', [
            'notification_id' => $notification->id,
            'user_id' => $validated['user_id'],
            'type' => $validated['type'],
        ]);

        return response()->json([
            'message' => 'Notification sent successfully.',
            'notification' => $notification
        ], 201);
    }

    /**
     * Broadcast notification to all users (Admin only)
     */
    public function broadcast(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'message' => 'required|string',
            'type' => 'required|string|max:50',
            'priority' => 'required|in:LOW,MEDIUM,HIGH,URGENT',
            'channel' => 'required|in:IN_APP,EMAIL,SMS,PUSH',
            'action_url' => 'nullable|url',
            'data' => 'nullable|array',
        ]);

        // Get all active users
        $users = \App\Models\User::whereNull('deleted_at')->get();

        $count = 0;
        foreach ($users as $user) {
            Notification::create([
                'user_id' => $user->id,
                'title' => $validated['title'],
                'message' => $validated['message'],
                'type' => $validated['type'],
                'priority' => $validated['priority'],
                'channel' => $validated['channel'],
                'action_url' => $validated['action_url'] ?? null,
                'data' => $validated['data'] ?? null,
            ]);
            $count++;
        }

        ActivityLog::log('NOTIFICATION_BROADCAST', $request->user()->id, 'Notification broadcast', [
            'recipients_count' => $count,
            'type' => $validated['type'],
        ]);

        return response()->json([
            'message' => "Notification sent to {$count} users.",
            'count' => $count
        ]);
    }

    /**
     * Get user notification preferences
     */
    public function getPreferences(Request $request)
    {
        $preferences = $this->notificationService->getPreferences($request->user()->id);

        return response()->json([
            'success' => true,
            'preferences' => $preferences
        ]);
    }

    /**
     * Update user notification preferences
     */
    public function updatePreferences(Request $request)
    {
        $validated = $request->validate([
            'preferences' => 'required|array',
            'preferences.*' => 'boolean',
        ]);

        $success = $this->notificationService->updatePreferences(
            $request->user()->id,
            $validated['preferences']
        );

        if ($success) {
            ActivityLog::log('NOTIFICATION_PREFERENCES_UPDATED', $request->user()->id, 'Notification preferences updated');

            return response()->json([
                'success' => true,
                'message' => 'Notification preferences updated successfully.'
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Failed to update notification preferences.'
        ], 500);
    }

    /**
     * Get notification statistics
     */
    public function statistics(Request $request)
    {
        $stats = $this->notificationService->getUserStatistics($request->user()->id);

        return response()->json([
            'success' => true,
            'statistics' => $stats
        ]);
    }

    /**
     * Bulk mark as read
     */
    public function bulkMarkAsRead(Request $request)
    {
        $validated = $request->validate([
            'notification_ids' => 'required|array',
            'notification_ids.*' => 'integer|exists:notifications,id',
        ]);

        $count = 0;
        foreach ($validated['notification_ids'] as $notificationId) {
            if ($this->notificationService->markAsRead($notificationId, $request->user()->id)) {
                $count++;
            }
        }

        return response()->json([
            'success' => true,
            'message' => "{$count} notifications marked as read.",
            'count' => $count
        ]);
    }

    /**
     * Bulk delete notifications
     */
    public function bulkDelete(Request $request)
    {
        $validated = $request->validate([
            'notification_ids' => 'required|array',
            'notification_ids.*' => 'integer|exists:notifications,id',
        ]);

        $count = $this->notificationService->bulkDelete(
            $validated['notification_ids'],
            $request->user()->id
        );

        ActivityLog::log('NOTIFICATIONS_BULK_DELETED', $request->user()->id, "Deleted {$count} notifications");

        return response()->json([
            'success' => true,
            'message' => "{$count} notifications deleted.",
            'count' => $count
        ]);
    }
}
