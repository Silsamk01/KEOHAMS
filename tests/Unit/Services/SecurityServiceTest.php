<?php

namespace Tests\Unit\Services;

use Tests\TestCase;
use App\Services\SecurityService;
use App\Models\User;
use App\Models\SecurityEvent;
use App\Models\BlockedIP;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;

class SecurityServiceTest extends TestCase
{
    protected SecurityService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new SecurityService();
    }

    /** @test */
    public function it_logs_security_event()
    {
        $user = User::factory()->create();

        $event = $this->service->logSecurityEvent(
            $user->id,
            'LOGIN_ATTEMPT',
            '192.168.1.1',
            'Test event'
        );

        $this->assertInstanceOf(SecurityEvent::class, $event);
        $this->assertEquals($user->id, $event->user_id);
        $this->assertEquals('LOGIN_ATTEMPT', $event->event_type);
        $this->assertDatabaseHas('security_events', [
            'user_id' => $user->id,
            'event_type' => 'LOGIN_ATTEMPT',
        ]);
    }

    /** @test */
    public function it_checks_if_ip_is_blocked()
    {
        $ip = '192.168.1.100';
        
        BlockedIP::create([
            'ip_address' => $ip,
            'reason' => 'Test block',
            'blocked_until' => now()->addHours(1),
        ]);

        $isBlocked = $this->service->isIPBlocked($ip);

        $this->assertTrue($isBlocked);
    }

    /** @test */
    public function expired_ip_blocks_are_not_considered_blocked()
    {
        $ip = '192.168.1.100';
        
        BlockedIP::create([
            'ip_address' => $ip,
            'reason' => 'Test block',
            'blocked_until' => now()->subHours(1), // Expired
        ]);

        $isBlocked = $this->service->isIPBlocked($ip);

        $this->assertFalse($isBlocked);
    }

    /** @test */
    public function it_blocks_ip_address()
    {
        $ip = '192.168.1.100';

        $blocked = $this->service->blockIP($ip, 'Suspicious activity', 24);

        $this->assertInstanceOf(BlockedIP::class, $blocked);
        $this->assertEquals($ip, $blocked->ip_address);
        $this->assertDatabaseHas('blocked_ips', [
            'ip_address' => $ip,
            'reason' => 'Suspicious activity',
        ]);
    }

    /** @test */
    public function it_unblocks_ip_address()
    {
        $ip = '192.168.1.100';
        
        BlockedIP::create([
            'ip_address' => $ip,
            'reason' => 'Test',
            'blocked_until' => now()->addDays(7),
        ]);

        $result = $this->service->unblockIP($ip);

        $this->assertTrue($result);
        $this->assertDatabaseMissing('blocked_ips', [
            'ip_address' => $ip,
        ]);
    }

    /** @test */
    public function it_detects_multiple_failed_login_attempts()
    {
        $user = User::factory()->create();
        $ip = '192.168.1.100';

        // Simulate 5 failed login attempts
        for ($i = 0; $i < 5; $i++) {
            $this->service->logSecurityEvent(
                $user->id,
                'LOGIN_FAILED',
                $ip,
                'Failed login attempt'
            );
        }

        $isThreat = $this->service->detectThreat($user->id, 'LOGIN_FAILED');

        $this->assertTrue($isThreat);
    }

    /** @test */
    public function it_automatically_blocks_ip_after_threat_detection()
    {
        $user = User::factory()->create();
        $ip = '192.168.1.100';

        // Simulate multiple suspicious activities
        for ($i = 0; $i < 10; $i++) {
            $this->service->logSecurityEvent(
                $user->id,
                'SUSPICIOUS_ACTIVITY',
                $ip,
                'Suspicious request'
            );
        }

        $this->assertTrue($this->service->isIPBlocked($ip));
    }

    /** @test */
    public function it_gets_user_security_events()
    {
        $user = User::factory()->create();
        
        SecurityEvent::factory()->count(5)->create(['user_id' => $user->id]);
        SecurityEvent::factory()->count(3)->create(); // Other user's events

        $events = $this->service->getUserSecurityEvents($user->id, 10);

        $this->assertCount(5, $events);
    }

    /** @test */
    public function it_gets_recent_security_events()
    {
        SecurityEvent::factory()->count(15)->create([
            'created_at' => now(),
        ]);
        
        SecurityEvent::factory()->count(5)->create([
            'created_at' => now()->subDays(10),
        ]);

        $events = $this->service->getRecentSecurityEvents(24, 10);

        $this->assertCount(10, $events);
    }

    /** @test */
    public function it_validates_password_strength()
    {
        $weakPassword = 'password';
        $strongPassword = 'StrongP@ssw0rd123';

        $this->assertFalse($this->service->validatePasswordStrength($weakPassword));
        $this->assertTrue($this->service->validatePasswordStrength($strongPassword));
    }

    /** @test */
    public function it_detects_brute_force_attempts()
    {
        $ip = '192.168.1.100';

        // Simulate rapid login attempts
        for ($i = 0; $i < 10; $i++) {
            RateLimiter::hit("login_attempts:$ip");
        }

        $isBruteForce = $this->service->detectBruteForce($ip);

        $this->assertTrue($isBruteForce);
    }

    /** @test */
    public function it_cleans_old_security_events()
    {
        SecurityEvent::factory()->count(5)->create([
            'created_at' => now()->subDays(100),
        ]);
        
        SecurityEvent::factory()->count(3)->create([
            'created_at' => now()->subDays(10),
        ]);

        $count = $this->service->cleanOldSecurityEvents(90);

        $this->assertEquals(5, $count);
        $this->assertEquals(3, SecurityEvent::count());
    }

    /** @test */
    public function it_checks_suspicious_user_agent()
    {
        $suspiciousUA = 'python-requests/2.28.0';
        $normalUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/96.0.4664.110';

        $this->assertTrue($this->service->isSuspiciousUserAgent($suspiciousUA));
        $this->assertFalse($this->service->isSuspiciousUserAgent($normalUA));
    }

    /** @test */
    public function it_rate_limits_api_requests()
    {
        $key = 'api_request:test_user';

        for ($i = 0; $i < 60; $i++) {
            RateLimiter::hit($key);
        }

        $isLimited = RateLimiter::tooManyAttempts($key, 60);

        $this->assertTrue($isLimited);
    }

    /** @test */
    public function it_gets_blocked_ips_list()
    {
        BlockedIP::factory()->count(5)->create([
            'blocked_until' => now()->addDays(1),
        ]);

        $blockedIPs = $this->service->getBlockedIPs();

        $this->assertCount(5, $blockedIPs);
    }
}
