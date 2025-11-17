<?php

namespace Tests\Unit\Services;

use Tests\TestCase;
use App\Services\NotificationService;
use App\Models\User;
use App\Models\Notification;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;
use App\Events\NotificationSent;

class NotificationServiceTest extends TestCase
{
    protected NotificationService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new NotificationService();
    }

    /** @test */
    public function it_creates_notification_successfully()
    {
        $user = User::factory()->create();

        $notification = $this->service->create(
            $user->id,
            'ORDER_PLACED',
            'Order Placed',
            'Your order has been placed successfully',
            ['order_id' => 123]
        );

        $this->assertInstanceOf(Notification::class, $notification);
        $this->assertEquals($user->id, $notification->user_id);
        $this->assertEquals('ORDER_PLACED', $notification->type);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $user->id,
            'type' => 'ORDER_PLACED',
        ]);
    }

    /** @test */
    public function it_respects_user_preferences_when_creating_notification()
    {
        $user = User::factory()->create([
            'notification_preferences' => [
                'ORDER_PLACED' => false, // User disabled this type
            ],
        ]);

        $notification = $this->service->create(
            $user->id,
            'ORDER_PLACED',
            'Order Placed',
            'Your order has been placed'
        );

        $this->assertNull($notification);
        $this->assertDatabaseMissing('notifications', [
            'user_id' => $user->id,
            'type' => 'ORDER_PLACED',
        ]);
    }

    /** @test */
    public function it_sends_notifications_to_multiple_users()
    {
        $users = User::factory()->count(3)->create();
        $userIds = $users->pluck('id')->toArray();

        $count = $this->service->sendToMultiple(
            $userIds,
            'SYSTEM_ANNOUNCEMENT',
            'System Update',
            'The system will be updated tonight'
        );

        $this->assertEquals(3, $count);
        
        foreach ($userIds as $userId) {
            $this->assertDatabaseHas('notifications', [
                'user_id' => $userId,
                'type' => 'SYSTEM_ANNOUNCEMENT',
            ]);
        }
    }

    /** @test */
    public function it_marks_notification_as_read()
    {
        $user = User::factory()->create();
        $notification = Notification::factory()->unread()->create(['user_id' => $user->id]);

        $result = $this->service->markAsRead($notification->id, $user->id);

        $this->assertTrue($result);
        $this->assertDatabaseHas('notifications', [
            'id' => $notification->id,
            'is_read' => true,
        ]);
    }

    /** @test */
    public function it_marks_all_notifications_as_read()
    {
        $user = User::factory()->create();
        Notification::factory()->unread()->count(5)->create(['user_id' => $user->id]);

        $count = $this->service->markAllAsRead($user->id);

        $this->assertEquals(5, $count);
        
        $unreadCount = Notification::where('user_id', $user->id)
                                   ->where('is_read', false)
                                   ->count();
        
        $this->assertEquals(0, $unreadCount);
    }

    /** @test */
    public function it_deletes_notification()
    {
        $user = User::factory()->create();
        $notification = Notification::factory()->create(['user_id' => $user->id]);

        $result = $this->service->delete($notification->id, $user->id);

        $this->assertTrue($result);
        $this->assertDatabaseMissing('notifications', [
            'id' => $notification->id,
        ]);
    }

    /** @test */
    public function it_bulk_deletes_notifications()
    {
        $user = User::factory()->create();
        $notifications = Notification::factory()->count(3)->create(['user_id' => $user->id]);
        $notificationIds = $notifications->pluck('id')->toArray();

        $count = $this->service->bulkDelete($notificationIds, $user->id);

        $this->assertEquals(3, $count);
        
        foreach ($notificationIds as $id) {
            $this->assertDatabaseMissing('notifications', ['id' => $id]);
        }
    }

    /** @test */
    public function it_gets_user_notifications_with_filters()
    {
        $user = User::factory()->create();
        Notification::factory()->unread()->count(3)->create(['user_id' => $user->id]);
        Notification::factory()->read()->count(2)->create(['user_id' => $user->id]);

        // Get all notifications
        $all = $this->service->getUserNotifications($user->id);
        $this->assertCount(5, $all);

        // Get only unread
        $unread = $this->service->getUserNotifications($user->id, true);
        $this->assertCount(3, $unread);
    }

    /** @test */
    public function it_gets_unread_count()
    {
        $user = User::factory()->create();
        Notification::factory()->unread()->count(7)->create(['user_id' => $user->id]);
        Notification::factory()->read()->count(3)->create(['user_id' => $user->id]);

        $count = $this->service->getUnreadCount($user->id);

        $this->assertEquals(7, $count);
    }

    /** @test */
    public function unread_count_is_cached()
    {
        $user = User::factory()->create();
        Notification::factory()->unread()->count(5)->create(['user_id' => $user->id]);

        // First call - should cache
        $count1 = $this->service->getUnreadCount($user->id);
        
        // Add more notifications
        Notification::factory()->unread()->count(3)->create(['user_id' => $user->id]);
        
        // Second call - should return cached value
        $count2 = $this->service->getUnreadCount($user->id);
        
        $this->assertEquals(5, $count1);
        $this->assertEquals(5, $count2); // Still 5 because cached
    }

    /** @test */
    public function it_gets_user_statistics()
    {
        $user = User::factory()->create();
        Notification::factory()->unread()->count(3)->create([
            'user_id' => $user->id,
            'type' => 'ORDER_PLACED',
        ]);
        Notification::factory()->read()->count(2)->create([
            'user_id' => $user->id,
            'type' => 'PAYMENT_SUCCESS',
        ]);

        $stats = $this->service->getUserStatistics($user->id);

        $this->assertEquals(5, $stats['total']);
        $this->assertEquals(3, $stats['unread']);
        $this->assertEquals(2, $stats['read']);
        $this->assertArrayHasKey('by_type', $stats);
        $this->assertArrayHasKey('recent_7_days', $stats);
    }

    /** @test */
    public function it_updates_user_preferences()
    {
        $user = User::factory()->create();

        $preferences = [
            'ORDER_PLACED' => true,
            'ORDER_SHIPPED' => false,
            'PAYMENT_SUCCESS' => true,
        ];

        $result = $this->service->updatePreferences($user->id, $preferences);

        $this->assertTrue($result);
        
        $userPrefs = $user->fresh()->notification_preferences;
        $this->assertTrue($userPrefs['ORDER_PLACED']);
        $this->assertFalse($userPrefs['ORDER_SHIPPED']);
    }

    /** @test */
    public function it_gets_user_preferences_or_defaults()
    {
        $user = User::factory()->create(['notification_preferences' => null]);

        $preferences = $this->service->getPreferences($user->id);

        $this->assertIsArray($preferences);
        $this->assertArrayHasKey('ORDER_PLACED', $preferences);
        $this->assertArrayHasKey('PAYMENT_SUCCESS', $preferences);
    }

    /** @test */
    public function it_deletes_old_notifications()
    {
        $user = User::factory()->create();
        
        // Create old notifications
        Notification::factory()->count(3)->create([
            'user_id' => $user->id,
            'created_at' => now()->subDays(100),
        ]);
        
        // Create recent notifications
        Notification::factory()->count(2)->create([
            'user_id' => $user->id,
            'created_at' => now()->subDays(10),
        ]);

        $count = $this->service->deleteOldNotifications(90);

        $this->assertEquals(3, $count);
        $this->assertEquals(2, Notification::count());
    }

    /** @test */
    public function it_sends_order_notification()
    {
        $user = User::factory()->create();
        $order = ['id' => 123, 'order_number' => 'ORD-123', 'total' => 99.99];

        $notification = $this->service->sendOrderNotification($user->id, 'PLACED', $order);

        $this->assertNotNull($notification);
        $this->assertEquals('ORDER_PLACED', $notification->type);
        $this->assertArrayHasKey('order_id', $notification->data);
    }

    /** @test */
    public function it_sends_payment_notification()
    {
        $user = User::factory()->create();
        $payment = ['id' => 456, 'amount' => 99.99, 'reference' => 'PAY-456'];

        $notification = $this->service->sendPaymentNotification($user->id, true, $payment);

        $this->assertNotNull($notification);
        $this->assertEquals('PAYMENT_SUCCESS', $notification->type);
        $this->assertArrayHasKey('payment_id', $notification->data);
    }

    /** @test */
    public function it_sends_kyc_notification()
    {
        $user = User::factory()->create();
        $kyc = ['id' => 789, 'status' => 'APPROVED', 'tier' => 'TIER_1'];

        $notification = $this->service->sendKYCNotification($user->id, 'APPROVED', $kyc);

        $this->assertNotNull($notification);
        $this->assertEquals('KYC_APPROVED', $notification->type);
        $this->assertArrayHasKey('kyc_id', $notification->data);
    }

    /** @test */
    public function it_sends_system_announcement_to_all_users()
    {
        User::factory()->count(5)->create(['is_active' => true]);
        User::factory()->count(2)->inactive()->create();

        $count = $this->service->sendSystemAnnouncement(
            'Maintenance Notice',
            'System will be down for maintenance'
        );

        $this->assertEquals(5, $count); // Only active users
        
        $notificationCount = Notification::where('type', 'SYSTEM_ANNOUNCEMENT')
                                        ->where('title', 'Maintenance Notice')
                                        ->count();
        
        $this->assertEquals(5, $notificationCount);
    }

    /** @test */
    public function it_sends_system_announcement_to_specific_users()
    {
        $users = User::factory()->count(3)->create();
        $userIds = $users->pluck('id')->toArray();

        $count = $this->service->sendSystemAnnouncement(
            'Important Update',
            'You have been selected for beta testing',
            $userIds
        );

        $this->assertEquals(3, $count);
    }

    /** @test */
    public function it_checks_if_notification_should_be_sent()
    {
        $user = User::factory()->create([
            'notification_preferences' => [
                'ORDER_PLACED' => true,
                'ORDER_SHIPPED' => false,
            ],
        ]);

        $this->assertTrue($this->service->shouldSendNotification($user->id, 'ORDER_PLACED'));
        $this->assertFalse($this->service->shouldSendNotification($user->id, 'ORDER_SHIPPED'));
    }

    /** @test */
    public function cache_is_cleared_after_creating_notification()
    {
        $user = User::factory()->create();
        
        // Get initial count (caches it)
        $this->service->getUnreadCount($user->id);
        
        // Create new notification
        $this->service->create($user->id, 'ORDER_PLACED', 'Test', 'Test message');
        
        // Get count again - should be updated
        $count = $this->service->getUnreadCount($user->id);
        
        $this->assertEquals(1, $count);
    }
}
