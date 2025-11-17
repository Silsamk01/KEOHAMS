<?php

namespace Database\Factories;

use App\Models\Order;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class OrderFactory extends Factory
{
    protected $model = Order::class;

    public function definition(): array
    {
        $subtotal = fake()->randomFloat(2, 50, 1000);
        $tax = $subtotal * 0.1;
        $shipping = fake()->randomFloat(2, 5, 25);
        $discount = fake()->optional()->randomFloat(2, 0, $subtotal * 0.2) ?? 0;
        $total = $subtotal + $tax + $shipping - $discount;

        return [
            'order_number' => 'ORD-' . strtoupper(fake()->unique()->bothify('####-????')),
            'user_id' => User::factory(),
            'status' => 'PENDING',
            'payment_status' => 'PENDING',
            'payment_method' => fake()->randomElement(['card', 'paypal', 'bank_transfer', 'cash']),
            'subtotal' => $subtotal,
            'tax' => $tax,
            'shipping_cost' => $shipping,
            'discount' => $discount,
            'total' => $total,
            'currency' => 'USD',
            'shipping_first_name' => fake()->firstName(),
            'shipping_last_name' => fake()->lastName(),
            'shipping_email' => fake()->safeEmail(),
            'shipping_phone' => fake()->phoneNumber(),
            'shipping_address' => fake()->streetAddress(),
            'shipping_city' => fake()->city(),
            'shipping_state' => fake()->state(),
            'shipping_postal_code' => fake()->postcode(),
            'shipping_country' => fake()->country(),
            'billing_first_name' => fake()->firstName(),
            'billing_last_name' => fake()->lastName(),
            'billing_email' => fake()->safeEmail(),
            'billing_phone' => fake()->phoneNumber(),
            'billing_address' => fake()->streetAddress(),
            'billing_city' => fake()->city(),
            'billing_state' => fake()->state(),
            'billing_postal_code' => fake()->postcode(),
            'billing_country' => fake()->country(),
            'notes' => fake()->optional()->sentence(),
            'internal_notes' => null,
        ];
    }

    public function processing()
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'PROCESSING',
            'payment_status' => 'PAID',
        ]);
    }

    public function shipped()
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'SHIPPED',
            'payment_status' => 'PAID',
            'shipped_at' => now()->subDays(2),
        ]);
    }

    public function delivered()
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'DELIVERED',
            'payment_status' => 'PAID',
            'shipped_at' => now()->subDays(5),
            'delivered_at' => now()->subDay(),
        ]);
    }

    public function cancelled()
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'CANCELLED',
            'payment_status' => 'REFUNDED',
            'cancelled_at' => now()->subDay(),
        ]);
    }

    public function paid()
    {
        return $this->state(fn (array $attributes) => [
            'payment_status' => 'PAID',
        ]);
    }
}
