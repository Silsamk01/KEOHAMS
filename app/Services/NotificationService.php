<?php

namespace App\Services;

use App\Models\User;
use App\Models\Notification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class NotificationService
{
    /**
     * Create a new notification
     */
    public function create(int $userId, string $type, string $title, string $message, array $data = [], ?int $relatedId = null, ?string $relatedType = null): ?Notification
    {
        try {
            // Check user preferences
            if (!$this->shouldSendNotification($userId, $type)) {
                return null;
            }

            $notification = Notification::create([
                'user_id' => $userId,
                'type' => $type,
                'title' => $title,
                'message' => $message,
                'data' => $data,
                'related_id' => $relatedId,
                'related_type' => $relatedType,
                'is_read' => false,
                'read_at' => null,
            ]);

            // Clear cache for user's unread count
            Cache::forget("user_notifications_unread_count:{$userId}");

            // Broadcast notification for real-time updates
            $this->broadcastNotification($notification);

            Log::info("Notification created for user {$userId}: {$type}");
            return $notification;
        } catch (\Exception $e) {
            Log::error("Failed to create notification: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Send notification to multiple users
     */
    public function sendToMultiple(array $userIds, string $type, string $title, string $message, array $data = []): int
    {
        $count = 0;
        foreach ($userIds as $userId) {
            if ($this->create($userId, $type, $title, $message, $data)) {
                $count++;
            }
        }
        return $count;
    }

    /**
     * Mark notification as read
     */
    public function markAsRead(int $notificationId, int $userId): bool
    {
        try {
            $notification = Notification::where('id', $notificationId)
                ->where('user_id', $userId)
                ->first();

            if (!$notification) {
                return false;
            }

            $notification->update([
                'is_read' => true,
                'read_at' => now(),
            ]);

            Cache::forget("user_notifications_unread_count:{$userId}");
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to mark notification as read: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Mark all notifications as read for a user
     */
    public function markAllAsRead(int $userId): int
    {
        try {
            $count = Notification::where('user_id', $userId)
                ->where('is_read', false)
                ->update([
                    'is_read' => true,
                    'read_at' => now(),
                ]);

            Cache::forget("user_notifications_unread_count:{$userId}");
            return $count;
        } catch (\Exception $e) {
            Log::error("Failed to mark all notifications as read: " . $e->getMessage());
            return 0;
        }
    }

    /**
     * Delete notification
     */
    public function delete(int $notificationId, int $userId): bool
    {
        try {
            $deleted = Notification::where('id', $notificationId)
                ->where('user_id', $userId)
                ->delete();

            if ($deleted) {
                Cache::forget("user_notifications_unread_count:{$userId}");
            }

            return $deleted > 0;
        } catch (\Exception $e) {
            Log::error("Failed to delete notification: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Delete multiple notifications
     */
    public function bulkDelete(array $notificationIds, int $userId): int
    {
        try {
            $count = Notification::whereIn('id', $notificationIds)
                ->where('user_id', $userId)
                ->delete();

            if ($count > 0) {
                Cache::forget("user_notifications_unread_count:{$userId}");
            }

            return $count;
        } catch (\Exception $e) {
            Log::error("Failed to bulk delete notifications: " . $e->getMessage());
            return 0;
        }
    }

    /**
     * Get user notifications
     */
    public function getUserNotifications(int $userId, bool $unreadOnly = false, int $limit = 50, int $offset = 0)
    {
        $query = Notification::where('user_id', $userId)
            ->orderBy('created_at', 'desc');

        if ($unreadOnly) {
            $query->where('is_read', false);
        }

        return $query->skip($offset)->take($limit)->get();
    }

    /**
     * Get unread count for user
     */
    public function getUnreadCount(int $userId): int
    {
        return Cache::remember("user_notifications_unread_count:{$userId}", 300, function () use ($userId) {
            return Notification::where('user_id', $userId)
                ->where('is_read', false)
                ->count();
        });
    }

    /**
     * Get notification statistics for user
     */
    public function getUserStatistics(int $userId): array
    {
        $total = Notification::where('user_id', $userId)->count();
        $unread = $this->getUnreadCount($userId);
        $read = $total - $unread;

        $byType = Notification::where('user_id', $userId)
            ->select('type', DB::raw('count(*) as count'))
            ->groupBy('type')
            ->get()
            ->pluck('count', 'type')
            ->toArray();

        $recent = Notification::where('user_id', $userId)
            ->where('created_at', '>=', now()->subDays(7))
            ->count();

        return [
            'total' => $total,
            'unread' => $unread,
            'read' => $read,
            'by_type' => $byType,
            'recent_7_days' => $recent,
        ];
    }

    /**
     * Check if user should receive notification based on preferences
     */
    private function shouldSendNotification(int $userId, string $type): bool
    {
        $user = User::find($userId);
        if (!$user) {
            return false;
        }

        $preferences = $user->notification_preferences ?? [];
        
        // If no preferences set, send all notifications
        if (empty($preferences)) {
            return true;
        }

        // Check if this type is enabled
        return $preferences[$type] ?? true;
    }

    /**
     * Update user notification preferences
     */
    public function updatePreferences(int $userId, array $preferences): bool
    {
        try {
            $user = User::find($userId);
            if (!$user) {
                return false;
            }

            $user->notification_preferences = $preferences;
            $user->save();

            return true;
        } catch (\Exception $e) {
            Log::error("Failed to update notification preferences: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Get user notification preferences
     */
    public function getPreferences(int $userId): array
    {
        $user = User::find($userId);
        return $user->notification_preferences ?? $this->getDefaultPreferences();
    }

    /**
     * Get default notification preferences
     */
    public function getDefaultPreferences(): array
    {
        return [
            'ORDER_PLACED' => true,
            'ORDER_SHIPPED' => true,
            'ORDER_DELIVERED' => true,
            'ORDER_CANCELLED' => true,
            'PAYMENT_SUCCESS' => true,
            'PAYMENT_FAILED' => true,
            'KYC_APPROVED' => true,
            'KYC_REJECTED' => true,
            'QUOTATION_REPLIED' => true,
            'AFFILIATE_COMMISSION' => true,
            'WITHDRAWAL_APPROVED' => true,
            'WITHDRAWAL_REJECTED' => true,
            'SUPPORT_TICKET_REPLIED' => true,
            'NEW_MESSAGE' => true,
            'SECURITY_ALERT' => true,
            'SYSTEM_ANNOUNCEMENT' => true,
        ];
    }

    /**
     * Broadcast notification for real-time updates
     */
    private function broadcastNotification(Notification $notification): void
    {
        try {
            // This would integrate with Laravel Echo/Pusher/Redis
            // For now, just log it
            Log::info("Broadcasting notification {$notification->id} to user {$notification->user_id}");
            
            // Example broadcast implementation:
            // broadcast(new NotificationSent($notification))->toOthers();
        } catch (\Exception $e) {
            Log::error("Failed to broadcast notification: " . $e->getMessage());
        }
    }

    /**
     * Delete old notifications
     */
    public function deleteOldNotifications(int $daysOld = 90): int
    {
        try {
            $count = Notification::where('created_at', '<', now()->subDays($daysOld))
                ->delete();

            Log::info("Deleted {$count} old notifications (older than {$daysOld} days)");
            return $count;
        } catch (\Exception $e) {
            Log::error("Failed to delete old notifications: " . $e->getMessage());
            return 0;
        }
    }

    /**
     * Send order notification
     */
    public function sendOrderNotification(int $userId, string $status, $order): ?Notification
    {
        $titles = [
            'PENDING' => 'Order Placed Successfully',
            'PROCESSING' => 'Order is Being Processed',
            'SHIPPED' => 'Order Shipped',
            'DELIVERED' => 'Order Delivered',
            'CANCELLED' => 'Order Cancelled',
        ];

        $messages = [
            'PENDING' => "Your order #{$order->order_number} has been placed successfully.",
            'PROCESSING' => "Your order #{$order->order_number} is being processed.",
            'SHIPPED' => "Your order #{$order->order_number} has been shipped.",
            'DELIVERED' => "Your order #{$order->order_number} has been delivered.",
            'CANCELLED' => "Your order #{$order->order_number} has been cancelled.",
        ];

        return $this->create(
            $userId,
            'ORDER_' . strtoupper($status),
            $titles[$status] ?? 'Order Update',
            $messages[$status] ?? "Your order #{$order->order_number} has been updated.",
            [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'status' => $status,
                'total' => $order->total_amount,
            ],
            $order->id,
            'order'
        );
    }

    /**
     * Send payment notification
     */
    public function sendPaymentNotification(int $userId, bool $success, $payment): ?Notification
    {
        $type = $success ? 'PAYMENT_SUCCESS' : 'PAYMENT_FAILED';
        $title = $success ? 'Payment Successful' : 'Payment Failed';
        $message = $success 
            ? "Your payment of ₦" . number_format($payment->amount, 2) . " was successful."
            : "Your payment of ₦" . number_format($payment->amount, 2) . " failed. Please try again.";

        return $this->create(
            $userId,
            $type,
            $title,
            $message,
            [
                'payment_id' => $payment->id,
                'amount' => $payment->amount,
                'reference' => $payment->reference,
            ],
            $payment->id,
            'payment'
        );
    }

    /**
     * Send KYC notification
     */
    public function sendKYCNotification(int $userId, string $status, $kyc): ?Notification
    {
        $titles = [
            'APPROVED' => 'KYC Verification Approved',
            'REJECTED' => 'KYC Verification Rejected',
        ];

        $messages = [
            'APPROVED' => 'Your KYC verification has been approved. You now have full access to all features.',
            'REJECTED' => 'Your KYC verification was rejected. Please check the reason and resubmit.',
        ];

        return $this->create(
            $userId,
            'KYC_' . strtoupper($status),
            $titles[$status] ?? 'KYC Update',
            $messages[$status] ?? 'Your KYC status has been updated.',
            [
                'kyc_id' => $kyc->id,
                'status' => $status,
                'tier' => $kyc->tier,
            ],
            $kyc->id,
            'kyc'
        );
    }

    /**
     * Send affiliate notification
     */
    public function sendAffiliateNotification(int $userId, string $type, $data): ?Notification
    {
        $titles = [
            'COMMISSION' => 'New Commission Earned',
            'WITHDRAWAL_APPROVED' => 'Withdrawal Approved',
            'WITHDRAWAL_REJECTED' => 'Withdrawal Rejected',
            'WITHDRAWAL_COMPLETED' => 'Withdrawal Completed',
        ];

        $messages = [
            'COMMISSION' => "You earned ₦" . number_format($data['amount'], 2) . " in commission!",
            'WITHDRAWAL_APPROVED' => "Your withdrawal of ₦" . number_format($data['amount'], 2) . " has been approved.",
            'WITHDRAWAL_REJECTED' => "Your withdrawal of ₦" . number_format($data['amount'], 2) . " was rejected.",
            'WITHDRAWAL_COMPLETED' => "Your withdrawal of ₦" . number_format($data['amount'], 2) . " is complete.",
        ];

        return $this->create(
            $userId,
            'AFFILIATE_' . $type,
            $titles[$type] ?? 'Affiliate Update',
            $messages[$type] ?? 'Your affiliate status has been updated.',
            $data
        );
    }

    /**
     * Send support ticket notification
     */
    public function sendTicketNotification(int $userId, $ticket): ?Notification
    {
        return $this->create(
            $userId,
            'SUPPORT_TICKET_REPLIED',
            'New Reply on Your Support Ticket',
            "You have a new reply on ticket #{$ticket->ticket_number}.",
            [
                'ticket_id' => $ticket->id,
                'ticket_number' => $ticket->ticket_number,
                'subject' => $ticket->subject,
            ],
            $ticket->id,
            'ticket'
        );
    }

    /**
     * Send system announcement
     */
    public function sendSystemAnnouncement(string $title, string $message, array $userIds = []): int
    {
        // If no specific users, send to all active users
        if (empty($userIds)) {
            $userIds = User::where('is_active', true)->pluck('id')->toArray();
        }

        return $this->sendToMultiple(
            $userIds,
            'SYSTEM_ANNOUNCEMENT',
            $title,
            $message,
            ['priority' => 'high']
        );
    }
}
