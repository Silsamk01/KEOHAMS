<?php

namespace Tests\Feature\Controllers;

use Tests\TestCase;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;

class OrderControllerTest extends TestCase
{
    /** @test */
    public function authenticated_user_can_create_order()
    {
        $auth = $this->authenticateUser();
        $product = Product::factory()->create(['price' => 100, 'quantity' => 50]);

        $response = $this->postJson('/api/v1/orders', [
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 2,
                    'price' => 100,
                ],
            ],
            'shipping_address' => '123 Test St',
            'shipping_city' => 'Test City',
            'shipping_state' => 'Test State',
            'shipping_postal_code' => '12345',
            'shipping_country' => 'Test Country',
            'payment_method' => 'card',
        ], $auth['headers']);

        $response->assertStatus(201)
                 ->assertJson(['success' => true])
                 ->assertJsonStructure([
                     'order' => ['id', 'order_number', 'total', 'status'],
                 ]);

        $this->assertDatabaseHas('orders', [
            'user_id' => $auth['user']->id,
            'status' => 'PENDING',
        ]);
    }

    /** @test */
    public function order_creation_validates_product_availability()
    {
        $auth = $this->authenticateUser();
        $product = Product::factory()->create(['price' => 100, 'quantity' => 5]);

        $response = $this->postJson('/api/v1/orders', [
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 10, // More than available
                    'price' => 100,
                ],
            ],
            'shipping_address' => '123 Test St',
            'shipping_city' => 'Test City',
            'payment_method' => 'card',
        ], $auth['headers']);

        $response->assertStatus(422);
    }

    /** @test */
    public function user_can_view_their_orders()
    {
        $auth = $this->authenticateUser();
        Order::factory()->count(3)->create(['user_id' => $auth['user']->id]);
        Order::factory()->count(2)->create(); // Other user's orders

        $response = $this->getJson('/api/v1/orders', $auth['headers']);

        $response->assertStatus(200);
        $orders = $response->json('orders.data');
        
        $this->assertCount(3, $orders);
        foreach ($orders as $order) {
            $this->assertEquals($auth['user']->id, $order['user_id']);
        }
    }

    /** @test */
    public function user_can_view_single_order()
    {
        $auth = $this->authenticateUser();
        $order = Order::factory()->create(['user_id' => $auth['user']->id]);

        $response = $this->getJson("/api/v1/orders/{$order->id}", $auth['headers']);

        $response->assertStatus(200)
                 ->assertJson([
                     'success' => true,
                     'order' => [
                         'id' => $order->id,
                         'order_number' => $order->order_number,
                     ],
                 ]);
    }

    /** @test */
    public function user_cannot_view_other_users_orders()
    {
        $auth = $this->authenticateUser();
        $otherOrder = Order::factory()->create(); // Different user

        $response = $this->getJson("/api/v1/orders/{$otherOrder->id}", $auth['headers']);

        $response->assertStatus(403);
    }

    /** @test */
    public function admin_can_view_all_orders()
    {
        $auth = $this->authenticateAdmin();
        Order::factory()->count(5)->create();

        $response = $this->getJson('/api/v1/admin/orders', $auth['headers']);

        $response->assertStatus(200);
        $orders = $response->json('orders.data');
        
        $this->assertCount(5, $orders);
    }

    /** @test */
    public function admin_can_update_order_status()
    {
        $auth = $this->authenticateAdmin();
        $order = Order::factory()->create(['status' => 'PENDING']);

        $response = $this->putJson("/api/v1/admin/orders/{$order->id}/status", [
            'status' => 'PROCESSING',
        ], $auth['headers']);

        $response->assertStatus(200)
                 ->assertJson(['success' => true]);

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'status' => 'PROCESSING',
        ]);
    }

    /** @test */
    public function admin_can_update_payment_status()
    {
        $auth = $this->authenticateAdmin();
        $order = Order::factory()->create(['payment_status' => 'PENDING']);

        $response = $this->putJson("/api/v1/admin/orders/{$order->id}/payment-status", [
            'payment_status' => 'PAID',
        ], $auth['headers']);

        $response->assertStatus(200)
                 ->assertJson(['success' => true]);

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'payment_status' => 'PAID',
        ]);
    }

    /** @test */
    public function user_can_cancel_pending_order()
    {
        $auth = $this->authenticateUser();
        $order = Order::factory()->create([
            'user_id' => $auth['user']->id,
            'status' => 'PENDING',
        ]);

        $response = $this->postJson("/api/v1/orders/{$order->id}/cancel", [], $auth['headers']);

        $response->assertStatus(200)
                 ->assertJson(['success' => true]);

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'status' => 'CANCELLED',
        ]);
    }

    /** @test */
    public function user_cannot_cancel_shipped_order()
    {
        $auth = $this->authenticateUser();
        $order = Order::factory()->shipped()->create([
            'user_id' => $auth['user']->id,
        ]);

        $response = $this->postJson("/api/v1/orders/{$order->id}/cancel", [], $auth['headers']);

        $response->assertStatus(422);
    }

    /** @test */
    public function order_total_is_calculated_correctly()
    {
        $auth = $this->authenticateUser();
        $product1 = Product::factory()->create(['price' => 100, 'quantity' => 50]);
        $product2 = Product::factory()->create(['price' => 50, 'quantity' => 50]);

        $response = $this->postJson('/api/v1/orders', [
            'items' => [
                [
                    'product_id' => $product1->id,
                    'quantity' => 2,
                    'price' => 100,
                ],
                [
                    'product_id' => $product2->id,
                    'quantity' => 1,
                    'price' => 50,
                ],
            ],
            'shipping_address' => '123 Test St',
            'shipping_city' => 'Test City',
            'payment_method' => 'card',
            'shipping_cost' => 10,
        ], $auth['headers']);

        $response->assertStatus(201);
        
        $order = $response->json('order');
        $expectedSubtotal = (100 * 2) + (50 * 1); // 250
        $expectedTotal = $expectedSubtotal + 10; // 260 + shipping
        
        $this->assertEquals($expectedSubtotal, $order['subtotal']);
        $this->assertEquals($expectedTotal, $order['total']);
    }

    /** @test */
    public function orders_can_be_filtered_by_status()
    {
        $auth = $this->authenticateAdmin();
        Order::factory()->count(2)->create(['status' => 'PENDING']);
        Order::factory()->count(3)->create(['status' => 'PROCESSING']);

        $response = $this->getJson('/api/v1/admin/orders?status=PROCESSING', $auth['headers']);

        $response->assertStatus(200);
        $orders = $response->json('orders.data');
        
        $this->assertCount(3, $orders);
        foreach ($orders as $order) {
            $this->assertEquals('PROCESSING', $order['status']);
        }
    }

    /** @test */
    public function guest_cannot_create_order()
    {
        $product = Product::factory()->create();

        $response = $this->postJson('/api/v1/orders', [
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 1,
                    'price' => 100,
                ],
            ],
        ]);

        $response->assertStatus(401);
    }

    /** @test */
    public function order_updates_product_quantity()
    {
        $auth = $this->authenticateUser();
        $product = Product::factory()->create(['price' => 100, 'quantity' => 50]);

        $response = $this->postJson('/api/v1/orders', [
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 5,
                    'price' => 100,
                ],
            ],
            'shipping_address' => '123 Test St',
            'shipping_city' => 'Test City',
            'payment_method' => 'card',
        ], $auth['headers']);

        $response->assertStatus(201);

        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'quantity' => 45, // 50 - 5
        ]);
    }
}
