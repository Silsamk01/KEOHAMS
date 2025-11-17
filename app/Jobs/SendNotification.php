<?php

namespace App\Jobs;

use App\Models\Notification as NotificationModel;
use App\Models\User;
use App\Events\NotificationCreated;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $userId;
    public $title;
    public $message;
    public $type;
    public $relatedId;
    public $relatedType;
    public $actionUrl;

    /**
     * Job timeout in seconds
     */
    public $timeout = 60;

    /**
     * Number of times to retry
     */
    public $tries = 3;

    /**
     * Create a new job instance
     */
    public function __construct(
        int $userId,
        string $title,
        string $message,
        string $type = 'INFO',
        ?int $relatedId = null,
        ?string $relatedType = null,
        ?string $actionUrl = null
    ) {
        $this->userId = $userId;
        $this->title = $title;
        $this->message = $message;
        $this->type = $type;
        $this->relatedId = $relatedId;
        $this->relatedType = $relatedType;
        $this->actionUrl = $actionUrl;
    }

    /**
     * Execute the job
     */
    public function handle(): void
    {
        try {
            // Verify user exists
            $user = User::find($this->userId);
            if (!$user) {
                Log::warning('Notification job skipped: User not found', [
                    'user_id' => $this->userId
                ]);
                return;
            }

            // Create notification
            $notification = NotificationModel::create([
                'user_id' => $this->userId,
                'title' => $this->title,
                'message' => $this->message,
                'type' => $this->type,
                'related_id' => $this->relatedId,
                'related_type' => $this->relatedType,
                'action_url' => $this->actionUrl,
                'is_read' => false,
            ]);

            Log::info('Notification created successfully', [
                'notification_id' => $notification->id,
                'user_id' => $this->userId,
                'type' => $this->type,
            ]);

            // Send real-time notification via broadcasting
            broadcast(new NotificationCreated($notification))->toOthers();

        } catch (\Exception $e) {
            Log::error('Failed to send notification', [
                'user_id' => $this->userId,
                'title' => $this->title,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            throw $e;
        }
    }

    /**
     * Handle job failure
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('SendNotification job failed permanently', [
            'user_id' => $this->userId,
            'title' => $this->title,
            'error' => $exception->getMessage(),
        ]);
    }
}
