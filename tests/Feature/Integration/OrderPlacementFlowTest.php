<?php

namespace Tests\Feature\Integration;

use Tests\TestCase;
use App\Models\User;
use App\Models\Product;
use App\Models\Order;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Event;
use App\Events\OrderCreated;

class OrderPlacementFlowTest extends TestCase
{
    /** @test */
    public function complete_order_placement_flow_works()
    {
        Mail::fake();
        Event::fake();

        // 1. User registers
        $registerResponse = $this->postJson('/api/v1/auth/register', [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'john@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'phone' => '1234567890',
        ]);

        $registerResponse->assertStatus(201);

        // 2. Verify email (simulate)
        $user = User::where('email', 'john@example.com')->first();
        $user->update(['email_verified_at' => now()]);

        // 3. Login
        $loginResponse = $this->postJson('/api/v1/auth/login', [
            'email' => 'john@example.com',
            'password' => 'Password123!',
        ]);

        $loginResponse->assertStatus(200);
        $token = $loginResponse->json('token');
        $headers = ['Authorization' => 'Bearer ' . $token, 'Accept' => 'application/json'];

        // 4. Browse products
        $product = Product::factory()->create([
            'price' => 99.99,
            'quantity' => 50,
            'status' => 'ACTIVE',
        ]);

        $productsResponse = $this->getJson('/api/v1/products', $headers);
        $productsResponse->assertStatus(200);

        // 5. View product details
        $productResponse = $this->getJson("/api/v1/products/{$product->slug}", $headers);
        $productResponse->assertStatus(200);

        // 6. Place order
        $orderResponse = $this->postJson('/api/v1/orders', [
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 2,
                    'price' => $product->price,
                ],
            ],
            'shipping_address' => '123 Test St',
            'shipping_city' => 'Test City',
            'shipping_state' => 'Test State',
            'shipping_postal_code' => '12345',
            'shipping_country' => 'Test Country',
            'payment_method' => 'card',
        ], $headers);

        $orderResponse->assertStatus(201);
        $order = $orderResponse->json('order');

        // 7. Verify order was created
        $this->assertDatabaseHas('orders', [
            'id' => $order['id'],
            'user_id' => $user->id,
            'status' => 'PENDING',
        ]);

        // 8. Verify product quantity was decreased
        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'quantity' => 48, // 50 - 2
        ]);

        // 9. Verify order details
        $viewOrderResponse = $this->getJson("/api/v1/orders/{$order['id']}", $headers);
        $viewOrderResponse->assertStatus(200)
                         ->assertJson([
                             'success' => true,
                             'order' => [
                                 'id' => $order['id'],
                                 'status' => 'PENDING',
                             ],
                         ]);

        // 10. Verify events were dispatched
        Event::assertDispatched(OrderCreated::class);
    }

    /** @test */
    public function order_with_insufficient_stock_fails()
    {
        $auth = $this->authenticateUser();
        $product = Product::factory()->create([
            'price' => 99.99,
            'quantity' => 5, // Only 5 available
        ]);

        $orderResponse = $this->postJson('/api/v1/orders', [
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 10, // Trying to order 10
                    'price' => $product->price,
                ],
            ],
            'shipping_address' => '123 Test St',
            'shipping_city' => 'Test City',
            'payment_method' => 'card',
        ], $auth['headers']);

        $orderResponse->assertStatus(422);
        
        // Verify product quantity unchanged
        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'quantity' => 5,
        ]);
    }

    /** @test */
    public function admin_can_process_order_through_complete_lifecycle()
    {
        $adminAuth = $this->authenticateAdmin();
        $customerAuth = $this->authenticateUser();
        
        // Customer places order
        $product = Product::factory()->create(['price' => 99.99, 'quantity' => 50]);
        $order = Order::factory()->create([
            'user_id' => $customerAuth['user']->id,
            'status' => 'PENDING',
        ]);

        // Admin updates to processing
        $this->putJson("/api/v1/admin/orders/{$order->id}/status", [
            'status' => 'PROCESSING',
        ], $adminAuth['headers'])->assertStatus(200);

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'status' => 'PROCESSING',
        ]);

        // Admin marks as shipped
        $this->putJson("/api/v1/admin/orders/{$order->id}/status", [
            'status' => 'SHIPPED',
        ], $adminAuth['headers'])->assertStatus(200);

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'status' => 'SHIPPED',
        ]);

        // Admin marks as delivered
        $this->putJson("/api/v1/admin/orders/{$order->id}/status", [
            'status' => 'DELIVERED',
        ], $adminAuth['headers'])->assertStatus(200);

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'status' => 'DELIVERED',
        ]);
    }
}
