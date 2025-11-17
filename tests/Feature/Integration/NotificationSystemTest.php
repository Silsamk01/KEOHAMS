<?php

namespace Tests\Feature\Integration;

use Tests\TestCase;
use App\Models\User;
use App\Models\Notification;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Cache;
use App\Events\NotificationSent;

class NotificationSystemTest extends TestCase
{
    protected NotificationService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new NotificationService();
    }

    /** @test */
    public function notification_flow_from_creation_to_reading_works()
    {
        Event::fake();
        $user = User::factory()->create();

        // 1. Create notification
        $notification = $this->service->create(
            $user->id,
            'ORDER_PLACED',
            'Order Placed',
            'Your order #12345 has been placed successfully',
            ['order_id' => 12345]
        );

        $this->assertNotNull($notification);
        $this->assertDatabaseHas('notifications', [
            'id' => $notification->id,
            'user_id' => $user->id,
            'is_read' => false,
        ]);

        // 2. Verify event was dispatched
        Event::assertDispatched(NotificationSent::class);

        // 3. Get unread count
        $unreadCount = $this->service->getUnreadCount($user->id);
        $this->assertEquals(1, $unreadCount);

        // 4. Mark as read
        $this->service->markAsRead($notification->id, $user->id);
        
        $this->assertDatabaseHas('notifications', [
            'id' => $notification->id,
            'is_read' => true,
        ]);

        // 5. Verify unread count updated
        Cache::forget("notifications:unread_count:{$user->id}");
        $unreadCount = $this->service->getUnreadCount($user->id);
        $this->assertEquals(0, $unreadCount);
    }

    /** @test */
    public function notification_preferences_are_respected()
    {
        $user = User::factory()->create();

        // 1. Set preferences
        $preferences = [
            'ORDER_PLACED' => true,
            'ORDER_SHIPPED' => false,
            'PAYMENT_SUCCESS' => true,
        ];
        
        $this->service->updatePreferences($user->id, $preferences);

        // 2. Try to send disabled notification type
        $notification1 = $this->service->create(
            $user->id,
            'ORDER_SHIPPED',
            'Order Shipped',
            'Your order has been shipped'
        );

        $this->assertNull($notification1);

        // 3. Send enabled notification type
        $notification2 = $this->service->create(
            $user->id,
            'ORDER_PLACED',
            'Order Placed',
            'Your order has been placed'
        );

        $this->assertNotNull($notification2);
        $this->assertDatabaseHas('notifications', [
            'id' => $notification2->id,
            'type' => 'ORDER_PLACED',
        ]);
    }

    /** @test */
    public function bulk_operations_work_correctly()
    {
        $user = User::factory()->create();

        // 1. Create multiple notifications
        $count = $this->service->sendToMultiple(
            [$user->id],
            'SYSTEM_ANNOUNCEMENT',
            'System Update',
            'System will be down for maintenance',
            null,
            5 // Create 5 notifications
        );

        $notifications = Notification::where('user_id', $user->id)->pluck('id')->toArray();
        $this->assertCount(5, $notifications);

        // 2. Bulk mark as read
        foreach ($notifications as $notificationId) {
            $this->service->markAsRead($notificationId, $user->id);
        }

        $readCount = Notification::where('user_id', $user->id)
                                 ->where('is_read', true)
                                 ->count();
        
        $this->assertEquals(5, $readCount);

        // 3. Bulk delete
        $deletedCount = $this->service->bulkDelete($notifications, $user->id);
        $this->assertEquals(5, $deletedCount);

        $this->assertEquals(0, Notification::where('user_id', $user->id)->count());
    }

    /** @test */
    public function notification_statistics_are_accurate()
    {
        $user = User::factory()->create();

        // Create various notifications
        Notification::factory()->unread()->count(3)->create([
            'user_id' => $user->id,
            'type' => 'ORDER_PLACED',
        ]);

        Notification::factory()->read()->count(2)->create([
            'user_id' => $user->id,
            'type' => 'PAYMENT_SUCCESS',
        ]);

        Notification::factory()->unread()->count(1)->create([
            'user_id' => $user->id,
            'type' => 'KYC_APPROVED',
        ]);

        $stats = $this->service->getUserStatistics($user->id);

        $this->assertEquals(6, $stats['total']);
        $this->assertEquals(4, $stats['unread']);
        $this->assertEquals(2, $stats['read']);
        $this->assertArrayHasKey('ORDER_PLACED', $stats['by_type']);
        $this->assertEquals(3, $stats['by_type']['ORDER_PLACED']);
        $this->assertEquals(2, $stats['by_type']['PAYMENT_SUCCESS']);
    }

    /** @test */
    public function system_announcement_reaches_all_active_users()
    {
        User::factory()->count(5)->create(['is_active' => true]);
        User::factory()->count(2)->inactive()->create();

        $count = $this->service->sendSystemAnnouncement(
            'Maintenance Notice',
            'System will be down from 2am to 4am'
        );

        $this->assertEquals(5, $count);
        
        $notificationCount = Notification::where('type', 'SYSTEM_ANNOUNCEMENT')
                                        ->where('title', 'Maintenance Notice')
                                        ->count();
        
        $this->assertEquals(5, $notificationCount);
    }

    /** @test */
    public function notification_caching_improves_performance()
    {
        $user = User::factory()->create();
        Notification::factory()->unread()->count(10)->create(['user_id' => $user->id]);

        // First call - caches result
        $startTime = microtime(true);
        $count1 = $this->service->getUnreadCount($user->id);
        $firstCallTime = microtime(true) - $startTime;

        // Second call - uses cache (should be faster)
        $startTime = microtime(true);
        $count2 = $this->service->getUnreadCount($user->id);
        $secondCallTime = microtime(true) - $startTime;

        $this->assertEquals(10, $count1);
        $this->assertEquals(10, $count2);
        $this->assertLessThan($firstCallTime, $secondCallTime);
    }

    /** @test */
    public function old_notifications_can_be_cleaned_up()
    {
        $user = User::factory()->create();

        // Create old notifications
        Notification::factory()->count(10)->create([
            'user_id' => $user->id,
            'created_at' => now()->subDays(100),
        ]);

        // Create recent notifications
        Notification::factory()->count(5)->create([
            'user_id' => $user->id,
            'created_at' => now()->subDays(30),
        ]);

        $deletedCount = $this->service->deleteOldNotifications(90);

        $this->assertEquals(10, $deletedCount);
        $this->assertEquals(5, Notification::where('user_id', $user->id)->count());
    }
}
