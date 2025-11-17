<?php

namespace Tests\Feature\Controllers;

use Tests\TestCase;
use App\Models\Notification;
use App\Models\User;

class NotificationControllerTest extends TestCase
{
    /** @test */
    public function user_can_get_their_notifications()
    {
        $auth = $this->authenticateUser();
        Notification::factory()->count(5)->create(['user_id' => $auth['user']->id]);
        Notification::factory()->count(3)->create(); // Other user's notifications

        $response = $this->getJson('/api/v1/notifications', $auth['headers']);

        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'success',
                     'notifications' => [
                         'data' => [
                             '*' => ['id', 'type', 'title', 'message', 'is_read'],
                         ],
                     ],
                 ]);

        $this->assertCount(5, $response->json('notifications.data'));
    }

    /** @test */
    public function user_can_get_unread_count()
    {
        $auth = $this->authenticateUser();
        Notification::factory()->unread()->count(3)->create(['user_id' => $auth['user']->id]);
        Notification::factory()->read()->count(2)->create(['user_id' => $auth['user']->id]);

        $response = $this->getJson('/api/v1/notifications/unread-count', $auth['headers']);

        $response->assertStatus(200)
                 ->assertJson([
                     'success' => true,
                     'unread_count' => 3,
                 ]);
    }

    /** @test */
    public function user_can_mark_notification_as_read()
    {
        $auth = $this->authenticateUser();
        $notification = Notification::factory()->unread()->create(['user_id' => $auth['user']->id]);

        $response = $this->postJson("/api/v1/notifications/{$notification->id}/read", [], $auth['headers']);

        $response->assertStatus(200)
                 ->assertJson(['success' => true]);

        $this->assertDatabaseHas('notifications', [
            'id' => $notification->id,
            'is_read' => true,
        ]);
    }

    /** @test */
    public function user_can_mark_all_notifications_as_read()
    {
        $auth = $this->authenticateUser();
        Notification::factory()->unread()->count(5)->create(['user_id' => $auth['user']->id]);

        $response = $this->postJson('/api/v1/notifications/read-all', [], $auth['headers']);

        $response->assertStatus(200)
                 ->assertJson(['success' => true]);

        $unreadCount = Notification::where('user_id', $auth['user']->id)
                                   ->where('is_read', false)
                                   ->count();
        
        $this->assertEquals(0, $unreadCount);
    }

    /** @test */
    public function user_can_delete_notification()
    {
        $auth = $this->authenticateUser();
        $notification = Notification::factory()->create(['user_id' => $auth['user']->id]);

        $response = $this->deleteJson("/api/v1/notifications/{$notification->id}", [], $auth['headers']);

        $response->assertStatus(200)
                 ->assertJson(['success' => true]);

        $this->assertDatabaseMissing('notifications', [
            'id' => $notification->id,
        ]);
    }

    /** @test */
    public function user_cannot_access_other_users_notifications()
    {
        $auth = $this->authenticateUser();
        $otherNotification = Notification::factory()->create(); // Different user

        $response = $this->postJson("/api/v1/notifications/{$otherNotification->id}/read", [], $auth['headers']);

        $response->assertStatus(403);
    }

    /** @test */
    public function user_can_get_notification_preferences()
    {
        $auth = $this->authenticateUser();

        $response = $this->getJson('/api/v1/notifications/preferences', $auth['headers']);

        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'success',
                     'preferences',
                 ]);
    }

    /** @test */
    public function user_can_update_notification_preferences()
    {
        $auth = $this->authenticateUser();

        $response = $this->putJson('/api/v1/notifications/preferences', [
            'preferences' => [
                'ORDER_PLACED' => true,
                'ORDER_SHIPPED' => false,
                'PAYMENT_SUCCESS' => true,
            ],
        ], $auth['headers']);

        $response->assertStatus(200)
                 ->assertJson(['success' => true]);

        $preferences = $auth['user']->fresh()->notification_preferences;
        $this->assertTrue($preferences['ORDER_PLACED']);
        $this->assertFalse($preferences['ORDER_SHIPPED']);
    }

    /** @test */
    public function user_can_get_notification_statistics()
    {
        $auth = $this->authenticateUser();
        Notification::factory()->unread()->count(3)->create(['user_id' => $auth['user']->id]);
        Notification::factory()->read()->count(2)->create(['user_id' => $auth['user']->id]);

        $response = $this->getJson('/api/v1/notifications/statistics', $auth['headers']);

        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'success',
                     'statistics' => [
                         'total',
                         'unread',
                         'read',
                         'by_type',
                         'recent_7_days',
                     ],
                 ]);

        $stats = $response->json('statistics');
        $this->assertEquals(5, $stats['total']);
        $this->assertEquals(3, $stats['unread']);
        $this->assertEquals(2, $stats['read']);
    }

    /** @test */
    public function user_can_bulk_mark_notifications_as_read()
    {
        $auth = $this->authenticateUser();
        $notifications = Notification::factory()->unread()->count(3)->create(['user_id' => $auth['user']->id]);
        $notificationIds = $notifications->pluck('id')->toArray();

        $response = $this->postJson('/api/v1/notifications/bulk-read', [
            'notification_ids' => $notificationIds,
        ], $auth['headers']);

        $response->assertStatus(200)
                 ->assertJson(['success' => true]);

        foreach ($notificationIds as $id) {
            $this->assertDatabaseHas('notifications', [
                'id' => $id,
                'is_read' => true,
            ]);
        }
    }

    /** @test */
    public function user_can_bulk_delete_notifications()
    {
        $auth = $this->authenticateUser();
        $notifications = Notification::factory()->count(3)->create(['user_id' => $auth['user']->id]);
        $notificationIds = $notifications->pluck('id')->toArray();

        $response = $this->postJson('/api/v1/notifications/bulk-delete', [
            'notification_ids' => $notificationIds,
        ], $auth['headers']);

        $response->assertStatus(200)
                 ->assertJson(['success' => true]);

        foreach ($notificationIds as $id) {
            $this->assertDatabaseMissing('notifications', [
                'id' => $id,
            ]);
        }
    }

    /** @test */
    public function admin_can_send_notification_to_user()
    {
        $auth = $this->authenticateAdmin();
        $user = User::factory()->create();

        $response = $this->postJson('/api/v1/admin/notifications/send', [
            'user_id' => $user->id,
            'type' => 'SYSTEM_ANNOUNCEMENT',
            'title' => 'Test Notification',
            'message' => 'This is a test message',
        ], $auth['headers']);

        $response->assertStatus(200)
                 ->assertJson(['success' => true]);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $user->id,
            'type' => 'SYSTEM_ANNOUNCEMENT',
            'title' => 'Test Notification',
        ]);
    }

    /** @test */
    public function admin_can_broadcast_notification_to_all_users()
    {
        $auth = $this->authenticateAdmin();
        User::factory()->count(5)->create(['is_active' => true]);

        $response = $this->postJson('/api/v1/admin/notifications/broadcast', [
            'type' => 'SYSTEM_ANNOUNCEMENT',
            'title' => 'System Update',
            'message' => 'System will be down for maintenance',
        ], $auth['headers']);

        $response->assertStatus(200)
                 ->assertJson(['success' => true]);

        $notificationCount = Notification::where('type', 'SYSTEM_ANNOUNCEMENT')
                                        ->where('title', 'System Update')
                                        ->count();
        
        $this->assertEquals(5, $notificationCount);
    }

    /** @test */
    public function customer_cannot_send_notifications()
    {
        $auth = $this->authenticateUser('CUSTOMER');
        $user = User::factory()->create();

        $response = $this->postJson('/api/v1/admin/notifications/send', [
            'user_id' => $user->id,
            'type' => 'SYSTEM_ANNOUNCEMENT',
            'title' => 'Test',
            'message' => 'Test message',
        ], $auth['headers']);

        $response->assertStatus(403);
    }

    /** @test */
    public function notifications_are_ordered_by_created_at_desc()
    {
        $auth = $this->authenticateUser();
        
        $old = Notification::factory()->create([
            'user_id' => $auth['user']->id,
            'created_at' => now()->subDays(2),
        ]);
        
        $new = Notification::factory()->create([
            'user_id' => $auth['user']->id,
            'created_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/notifications', $auth['headers']);

        $notifications = $response->json('notifications.data');
        $this->assertEquals($new->id, $notifications[0]['id']);
        $this->assertEquals($old->id, $notifications[1]['id']);
    }

    /** @test */
    public function notifications_can_be_filtered_by_unread_only()
    {
        $auth = $this->authenticateUser();
        Notification::factory()->unread()->count(3)->create(['user_id' => $auth['user']->id]);
        Notification::factory()->read()->count(2)->create(['user_id' => $auth['user']->id]);

        $response = $this->getJson('/api/v1/notifications?unread_only=true', $auth['headers']);

        $response->assertStatus(200);
        $notifications = $response->json('notifications.data');
        
        $this->assertCount(3, $notifications);
        foreach ($notifications as $notification) {
            $this->assertFalse($notification['is_read']);
        }
    }
}
