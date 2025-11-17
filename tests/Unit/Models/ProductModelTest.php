<?php

namespace Tests\Unit\Models;

use Tests\TestCase;
use App\Models\Product;
use App\Models\User;

class ProductModelTest extends TestCase
{
    /** @test */
    public function it_has_fillable_attributes()
    {
        $product = new Product([
            'name' => 'Test Product',
            'slug' => 'test-product',
            'price' => 99.99,
            'quantity' => 100,
        ]);

        $this->assertEquals('Test Product', $product->name);
        $this->assertEquals('test-product', $product->slug);
        $this->assertEquals(99.99, $product->price);
    }

    /** @test */
    public function it_casts_attributes_correctly()
    {
        $product = Product::factory()->create([
            'price' => 99.99,
            'quantity' => 100,
            'is_featured' => true,
            'meta_keywords' => 'keyword1,keyword2,keyword3',
        ]);

        $this->assertIsFloat($product->price);
        $this->assertIsInt($product->quantity);
        $this->assertIsBool($product->is_featured);
    }

    /** @test */
    public function it_has_creator_relationship()
    {
        $user = User::factory()->create();
        $product = Product::factory()->create(['created_by' => $user->id]);

        $this->assertInstanceOf(User::class, $product->creator);
        $this->assertEquals($user->id, $product->creator->id);
    }

    /** @test */
    public function it_scopes_active_products()
    {
        Product::factory()->count(3)->create(['status' => 'ACTIVE']);
        Product::factory()->count(2)->inactive()->create();

        $activeProducts = Product::active()->get();

        $this->assertCount(3, $activeProducts);
    }

    /** @test */
    public function it_scopes_featured_products()
    {
        Product::factory()->featured()->count(2)->create();
        Product::factory()->count(3)->create(['is_featured' => false]);

        $featuredProducts = Product::featured()->get();

        $this->assertCount(2, $featuredProducts);
    }

    /** @test */
    public function it_scopes_in_stock_products()
    {
        Product::factory()->count(3)->create(['quantity' => 10]);
        Product::factory()->outOfStock()->count(2)->create();

        $inStockProducts = Product::inStock()->get();

        $this->assertCount(3, $inStockProducts);
    }

    /** @test */
    public function it_scopes_low_stock_products()
    {
        Product::factory()->create(['quantity' => 5, 'low_stock_threshold' => 10]);
        Product::factory()->create(['quantity' => 50, 'low_stock_threshold' => 10]);

        $lowStockProducts = Product::lowStock()->get();

        $this->assertCount(1, $lowStockProducts);
    }

    /** @test */
    public function it_checks_if_product_is_in_stock()
    {
        $inStock = Product::factory()->create(['quantity' => 10]);
        $outOfStock = Product::factory()->outOfStock()->create();

        $this->assertTrue($inStock->isInStock());
        $this->assertFalse($outOfStock->isInStock());
    }

    /** @test */
    public function it_checks_if_product_is_low_stock()
    {
        $lowStock = Product::factory()->create([
            'quantity' => 5,
            'low_stock_threshold' => 10,
        ]);
        
        $normalStock = Product::factory()->create([
            'quantity' => 50,
            'low_stock_threshold' => 10,
        ]);

        $this->assertTrue($lowStock->isLowStock());
        $this->assertFalse($normalStock->isLowStock());
    }

    /** @test */
    public function it_decreases_quantity_when_sold()
    {
        $product = Product::factory()->create(['quantity' => 100]);

        $product->decreaseQuantity(10);

        $this->assertEquals(90, $product->fresh()->quantity);
    }

    /** @test */
    public function it_increases_quantity_when_restocked()
    {
        $product = Product::factory()->create(['quantity' => 100]);

        $product->increaseQuantity(20);

        $this->assertEquals(120, $product->fresh()->quantity);
    }

    /** @test */
    public function it_calculates_discount_percentage()
    {
        $product = Product::factory()->create([
            'price' => 80,
            'compare_price' => 100,
        ]);

        $this->assertEquals(20, $product->discountPercentage());
    }

    /** @test */
    public function it_returns_zero_discount_when_no_compare_price()
    {
        $product = Product::factory()->create([
            'price' => 100,
            'compare_price' => null,
        ]);

        $this->assertEquals(0, $product->discountPercentage());
    }

    /** @test */
    public function it_generates_unique_slug()
    {
        $product1 = Product::factory()->create(['name' => 'Test Product']);
        $product2 = Product::factory()->create(['name' => 'Test Product']);

        $this->assertNotEquals($product1->slug, $product2->slug);
    }

    /** @test */
    public function it_automatically_marks_as_out_of_stock_when_quantity_zero()
    {
        $product = Product::factory()->create([
            'quantity' => 1,
            'status' => 'ACTIVE',
        ]);

        $product->update(['quantity' => 0]);

        $this->assertEquals('OUT_OF_STOCK', $product->fresh()->status);
    }
}
