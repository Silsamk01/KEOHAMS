<?php

namespace Database\Factories;

use App\Models\SecurityEvent;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class SecurityEventFactory extends Factory
{
    protected $model = SecurityEvent::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'event_type' => fake()->randomElement([
                'LOGIN_ATTEMPT',
                'LOGIN_FAILED',
                'LOGIN_SUCCESS',
                'LOGOUT',
                'PASSWORD_CHANGED',
                'TWO_FACTOR_ENABLED',
                'TWO_FACTOR_DISABLED',
                'SUSPICIOUS_ACTIVITY',
                'IP_BLOCKED',
                'SECURITY_ALERT',
            ]),
            'ip_address' => fake()->ipv4(),
            'user_agent' => fake()->userAgent(),
            'description' => fake()->sentence(),
            'severity' => fake()->randomElement(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
            'metadata' => [
                'location' => fake()->city(),
                'device' => fake()->randomElement(['Desktop', 'Mobile', 'Tablet']),
            ],
        ];
    }

    public function loginAttempt()
    {
        return $this->state(fn (array $attributes) => [
            'event_type' => 'LOGIN_ATTEMPT',
            'severity' => 'LOW',
        ]);
    }

    public function loginFailed()
    {
        return $this->state(fn (array $attributes) => [
            'event_type' => 'LOGIN_FAILED',
            'severity' => 'MEDIUM',
        ]);
    }

    public function suspiciousActivity()
    {
        return $this->state(fn (array $attributes) => [
            'event_type' => 'SUSPICIOUS_ACTIVITY',
            'severity' => 'HIGH',
        ]);
    }

    public function critical()
    {
        return $this->state(fn (array $attributes) => [
            'severity' => 'CRITICAL',
        ]);
    }
}
