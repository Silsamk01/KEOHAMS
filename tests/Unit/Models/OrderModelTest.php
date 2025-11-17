<?php

namespace Tests\Unit\Models;

use Tests\TestCase;
use App\Models\Order;
use App\Models\User;
use App\Models\Product;

class OrderModelTest extends TestCase
{
    /** @test */
    public function it_has_fillable_attributes()
    {
        $order = new Order([
            'order_number' => 'ORD-12345',
            'status' => 'PENDING',
            'total' => 199.99,
        ]);

        $this->assertEquals('ORD-12345', $order->order_number);
        $this->assertEquals('PENDING', $order->status);
        $this->assertEquals(199.99, $order->total);
    }

    /** @test */
    public function it_belongs_to_user()
    {
        $user = User::factory()->create();
        $order = Order::factory()->create(['user_id' => $user->id]);

        $this->assertInstanceOf(User::class, $order->user);
        $this->assertEquals($user->id, $order->user->id);
    }

    /** @test */
    public function it_casts_dates_correctly()
    {
        $order = Order::factory()->create([
            'shipped_at' => now(),
            'delivered_at' => now(),
            'cancelled_at' => null,
        ]);

        $this->assertInstanceOf(\Illuminate\Support\Carbon::class, $order->shipped_at);
        $this->assertInstanceOf(\Illuminate\Support\Carbon::class, $order->delivered_at);
        $this->assertNull($order->cancelled_at);
    }

    /** @test */
    public function it_casts_numeric_fields_correctly()
    {
        $order = Order::factory()->create([
            'subtotal' => 100.50,
            'tax' => 10.05,
            'shipping_cost' => 5.00,
            'total' => 115.55,
        ]);

        $this->assertIsFloat($order->subtotal);
        $this->assertIsFloat($order->tax);
        $this->assertIsFloat($order->total);
    }

    /** @test */
    public function it_scopes_orders_by_status()
    {
        Order::factory()->count(2)->create(['status' => 'PENDING']);
        Order::factory()->count(3)->processing()->create();

        $pending = Order::status('PENDING')->get();
        $processing = Order::status('PROCESSING')->get();

        $this->assertCount(2, $pending);
        $this->assertCount(3, $processing);
    }

    /** @test */
    public function it_scopes_paid_orders()
    {
        Order::factory()->paid()->count(3)->create();
        Order::factory()->count(2)->create(['payment_status' => 'PENDING']);

        $paidOrders = Order::paid()->get();

        $this->assertCount(3, $paidOrders);
    }

    /** @test */
    public function it_scopes_unpaid_orders()
    {
        Order::factory()->count(2)->create(['payment_status' => 'PENDING']);
        Order::factory()->paid()->count(3)->create();

        $unpaidOrders = Order::unpaid()->get();

        $this->assertCount(2, $unpaidOrders);
    }

    /** @test */
    public function it_checks_if_order_is_pending()
    {
        $pendingOrder = Order::factory()->create(['status' => 'PENDING']);
        $shippedOrder = Order::factory()->shipped()->create();

        $this->assertTrue($pendingOrder->isPending());
        $this->assertFalse($shippedOrder->isPending());
    }

    /** @test */
    public function it_checks_if_order_is_cancelled()
    {
        $cancelledOrder = Order::factory()->cancelled()->create();
        $activeOrder = Order::factory()->create(['status' => 'PENDING']);

        $this->assertTrue($cancelledOrder->isCancelled());
        $this->assertFalse($activeOrder->isCancelled());
    }

    /** @test */
    public function it_checks_if_order_is_delivered()
    {
        $deliveredOrder = Order::factory()->delivered()->create();
        $pendingOrder = Order::factory()->create(['status' => 'PENDING']);

        $this->assertTrue($deliveredOrder->isDelivered());
        $this->assertFalse($pendingOrder->isDelivered());
    }

    /** @test */
    public function it_can_be_marked_as_paid()
    {
        $order = Order::factory()->create(['payment_status' => 'PENDING']);

        $order->markAsPaid();

        $this->assertEquals('PAID', $order->fresh()->payment_status);
    }

    /** @test */
    public function it_can_be_marked_as_shipped()
    {
        $order = Order::factory()->create(['status' => 'PROCESSING']);

        $order->markAsShipped();

        $this->assertEquals('SHIPPED', $order->fresh()->status);
        $this->assertNotNull($order->fresh()->shipped_at);
    }

    /** @test */
    public function it_can_be_marked_as_delivered()
    {
        $order = Order::factory()->shipped()->create();

        $order->markAsDelivered();

        $this->assertEquals('DELIVERED', $order->fresh()->status);
        $this->assertNotNull($order->fresh()->delivered_at);
    }

    /** @test */
    public function it_can_be_cancelled()
    {
        $order = Order::factory()->create(['status' => 'PENDING']);

        $order->cancel();

        $this->assertEquals('CANCELLED', $order->fresh()->status);
        $this->assertNotNull($order->fresh()->cancelled_at);
    }

    /** @test */
    public function it_calculates_total_correctly()
    {
        $order = Order::factory()->create([
            'subtotal' => 100,
            'tax' => 10,
            'shipping_cost' => 5,
            'discount' => 15,
        ]);

        $expectedTotal = 100 + 10 + 5 - 15; // 100

        $this->assertEquals($expectedTotal, $order->calculateTotal());
    }

    /** @test */
    public function it_generates_unique_order_number()
    {
        $order1 = Order::factory()->create();
        $order2 = Order::factory()->create();

        $this->assertNotEquals($order1->order_number, $order2->order_number);
        $this->assertStringStartsWith('ORD-', $order1->order_number);
    }

    /** @test */
    public function it_scopes_recent_orders()
    {
        Order::factory()->count(3)->create(['created_at' => now()]);
        Order::factory()->count(2)->create(['created_at' => now()->subMonths(2)]);

        $recentOrders = Order::recent(30)->get();

        $this->assertCount(3, $recentOrders);
    }

    /** @test */
    public function shipped_orders_cannot_be_cancelled()
    {
        $order = Order::factory()->shipped()->create();

        $result = $order->canBeCancelled();

        $this->assertFalse($result);
    }

    /** @test */
    public function pending_orders_can_be_cancelled()
    {
        $order = Order::factory()->create(['status' => 'PENDING']);

        $result = $order->canBeCancelled();

        $this->assertTrue($result);
    }
}
