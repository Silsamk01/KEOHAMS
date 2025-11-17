<?php

namespace Tests\Unit\Models;

use Tests\TestCase;
use App\Models\User;
use App\Models\Order;
use App\Models\Notification;
use Illuminate\Support\Facades\Hash;

class UserModelTest extends TestCase
{
    /** @test */
    public function it_has_fillable_attributes()
    {
        $user = new User([
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'john@example.com',
            'phone' => '1234567890',
        ]);

        $this->assertEquals('John', $user->first_name);
        $this->assertEquals('Doe', $user->last_name);
        $this->assertEquals('john@example.com', $user->email);
    }

    /** @test */
    public function it_hides_sensitive_attributes()
    {
        $user = User::factory()->create([
            'password' => Hash::make('password123'),
            'two_factor_secret' => 'secret',
        ]);

        $array = $user->toArray();

        $this->assertArrayNotHasKey('password', $array);
        $this->assertArrayNotHasKey('two_factor_secret', $array);
    }

    /** @test */
    public function it_has_orders_relationship()
    {
        $user = User::factory()->create();
        Order::factory()->count(3)->create(['user_id' => $user->id]);

        $this->assertCount(3, $user->orders);
        $this->assertInstanceOf(Order::class, $user->orders->first());
    }

    /** @test */
    public function it_has_notifications_relationship()
    {
        $user = User::factory()->create();
        Notification::factory()->count(5)->create(['user_id' => $user->id]);

        $this->assertCount(5, $user->notifications);
        $this->assertInstanceOf(Notification::class, $user->notifications->first());
    }

    /** @test */
    public function it_has_full_name_accessor()
    {
        $user = User::factory()->make([
            'first_name' => 'John',
            'last_name' => 'Doe',
        ]);

        $this->assertEquals('John Doe', $user->full_name);
    }

    /** @test */
    public function it_scopes_active_users()
    {
        User::factory()->count(3)->create(['is_active' => true]);
        User::factory()->count(2)->inactive()->create();

        $activeUsers = User::active()->get();

        $this->assertCount(3, $activeUsers);
    }

    /** @test */
    public function it_scopes_verified_users()
    {
        User::factory()->count(4)->create(['email_verified_at' => now()]);
        User::factory()->count(2)->unverified()->create();

        $verifiedUsers = User::verified()->get();

        $this->assertCount(4, $verifiedUsers);
    }

    /** @test */
    public function it_scopes_users_by_role()
    {
        User::factory()->count(2)->admin()->create();
        User::factory()->count(3)->create(['role' => 'CUSTOMER']);

        $admins = User::role('ADMIN')->get();
        $customers = User::role('CUSTOMER')->get();

        $this->assertCount(2, $admins);
        $this->assertCount(3, $customers);
    }

    /** @test */
    public function it_checks_if_user_is_admin()
    {
        $admin = User::factory()->admin()->make();
        $customer = User::factory()->make(['role' => 'CUSTOMER']);

        $this->assertTrue($admin->isAdmin());
        $this->assertFalse($customer->isAdmin());
    }

    /** @test */
    public function it_checks_if_user_is_super_admin()
    {
        $superAdmin = User::factory()->superAdmin()->make();
        $admin = User::factory()->admin()->make();

        $this->assertTrue($superAdmin->isSuperAdmin());
        $this->assertFalse($admin->isSuperAdmin());
    }

    /** @test */
    public function it_casts_attributes_correctly()
    {
        $user = User::factory()->create([
            'email_verified_at' => now(),
            'is_active' => true,
            'two_factor_enabled' => true,
            'notification_preferences' => ['ORDER_PLACED' => true],
        ]);

        $this->assertInstanceOf(\Illuminate\Support\Carbon::class, $user->email_verified_at);
        $this->assertIsBool($user->is_active);
        $this->assertIsBool($user->two_factor_enabled);
        $this->assertIsArray($user->notification_preferences);
    }

    /** @test */
    public function password_is_hashed_when_set()
    {
        $user = User::factory()->create([
            'password' => 'plain_password',
        ]);

        $this->assertNotEquals('plain_password', $user->password);
        $this->assertTrue(Hash::check('plain_password', $user->password));
    }

    /** @test */
    public function it_has_default_notification_preferences()
    {
        $user = User::factory()->create(['notification_preferences' => null]);

        $this->assertIsArray($user->notification_preferences);
    }
}
