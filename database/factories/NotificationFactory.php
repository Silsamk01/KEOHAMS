<?php

namespace Database\Factories;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class NotificationFactory extends Factory
{
    protected $model = Notification::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'type' => fake()->randomElement([
                'ORDER_PLACED',
                'ORDER_SHIPPED',
                'ORDER_DELIVERED',
                'PAYMENT_SUCCESS',
                'KYC_APPROVED',
                'NEW_MESSAGE',
                'SYSTEM_ANNOUNCEMENT',
            ]),
            'title' => fake()->sentence(),
            'message' => fake()->paragraph(),
            'data' => [
                'action_url' => fake()->url(),
                'extra_data' => fake()->words(3),
            ],
            'is_read' => fake()->boolean(30),
            'read_at' => fake()->optional(0.3)->dateTime(),
        ];
    }

    public function unread()
    {
        return $this->state(fn (array $attributes) => [
            'is_read' => false,
            'read_at' => null,
        ]);
    }

    public function read()
    {
        return $this->state(fn (array $attributes) => [
            'is_read' => true,
            'read_at' => now(),
        ]);
    }

    public function orderNotification()
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'ORDER_PLACED',
            'title' => 'New Order Placed',
            'message' => 'Your order has been successfully placed.',
        ]);
    }

    public function paymentNotification()
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'PAYMENT_SUCCESS',
            'title' => 'Payment Successful',
            'message' => 'Your payment has been processed successfully.',
        ]);
    }
}
