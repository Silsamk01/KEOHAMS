<?php

namespace Database\Factories;

use App\Models\BlockedIP;
use Illuminate\Database\Eloquent\Factories\Factory;

class BlockedIPFactory extends Factory
{
    protected $model = BlockedIP::class;

    public function definition(): array
    {
        return [
            'ip_address' => fake()->unique()->ipv4(),
            'reason' => fake()->randomElement([
                'Multiple failed login attempts',
                'Suspicious activity detected',
                'Brute force attack',
                'SQL injection attempt',
                'DDoS attack',
                'Manual block by admin',
            ]),
            'blocked_by' => null,
            'blocked_until' => fake()->optional()->dateTimeBetween('now', '+30 days'),
            'is_permanent' => fake()->boolean(20),
            'metadata' => [
                'failed_attempts' => fake()->numberBetween(5, 100),
                'last_attempt' => fake()->dateTimeThisMonth()->format('Y-m-d H:i:s'),
            ],
        ];
    }

    public function permanent()
    {
        return $this->state(fn (array $attributes) => [
            'is_permanent' => true,
            'blocked_until' => null,
        ]);
    }

    public function temporary()
    {
        return $this->state(fn (array $attributes) => [
            'is_permanent' => false,
            'blocked_until' => now()->addHours(24),
        ]);
    }

    public function expired()
    {
        return $this->state(fn (array $attributes) => [
            'is_permanent' => false,
            'blocked_until' => now()->subHours(1),
        ]);
    }
}
