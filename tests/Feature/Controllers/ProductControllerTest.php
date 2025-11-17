<?php

namespace Tests\Feature\Controllers;

use Tests\TestCase;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class ProductControllerTest extends TestCase
{
    /** @test */
    public function guest_can_list_active_products()
    {
        Product::factory()->count(5)->create(['status' => 'ACTIVE']);
        Product::factory()->count(3)->inactive()->create();

        $response = $this->getJson('/api/v1/products');

        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'success',
                     'products' => [
                         'data' => [
                             '*' => ['id', 'name', 'slug', 'price', 'quantity', 'status'],
                         ],
                         'current_page',
                         'total',
                     ],
                 ]);

        // Only active products should be returned
        $this->assertCount(5, $response->json('products.data'));
    }

    /** @test */
    public function guest_can_view_single_product()
    {
        $product = Product::factory()->create(['status' => 'ACTIVE']);

        $response = $this->getJson("/api/v1/products/{$product->slug}");

        $response->assertStatus(200)
                 ->assertJson([
                     'success' => true,
                     'product' => [
                         'id' => $product->id,
                         'name' => $product->name,
                         'slug' => $product->slug,
                     ],
                 ]);
    }

    /** @test */
    public function guest_cannot_view_inactive_product()
    {
        $product = Product::factory()->inactive()->create();

        $response = $this->getJson("/api/v1/products/{$product->slug}");

        $response->assertStatus(404);
    }

    /** @test */
    public function products_can_be_filtered_by_price_range()
    {
        Product::factory()->create(['price' => 50, 'status' => 'ACTIVE']);
        Product::factory()->create(['price' => 150, 'status' => 'ACTIVE']);
        Product::factory()->create(['price' => 250, 'status' => 'ACTIVE']);

        $response = $this->getJson('/api/v1/products?min_price=100&max_price=200');

        $response->assertStatus(200);
        $products = $response->json('products.data');
        
        $this->assertCount(1, $products);
        $this->assertEquals(150, $products[0]['price']);
    }

    /** @test */
    public function products_can_be_searched_by_name()
    {
        Product::factory()->create(['name' => 'Blue Widget', 'status' => 'ACTIVE']);
        Product::factory()->create(['name' => 'Red Gadget', 'status' => 'ACTIVE']);

        $response = $this->getJson('/api/v1/products?search=Blue');

        $response->assertStatus(200);
        $products = $response->json('products.data');
        
        $this->assertCount(1, $products);
        $this->assertStringContainsString('Blue', $products[0]['name']);
    }

    /** @test */
    public function admin_can_create_product()
    {
        Storage::fake('public');
        $auth = $this->authenticateAdmin();

        $response = $this->postJson('/api/v1/admin/products', [
            'name' => 'New Product',
            'description' => 'Product description',
            'price' => 99.99,
            'sku' => 'SKU-12345',
            'quantity' => 100,
            'status' => 'ACTIVE',
        ], $auth['headers']);

        $response->assertStatus(201)
                 ->assertJson(['success' => true]);

        $this->assertDatabaseHas('products', [
            'name' => 'New Product',
            'price' => 99.99,
            'sku' => 'SKU-12345',
        ]);
    }

    /** @test */
    public function admin_can_update_product()
    {
        $auth = $this->authenticateAdmin();
        $product = Product::factory()->create();

        $response = $this->putJson("/api/v1/admin/products/{$product->id}", [
            'name' => 'Updated Product Name',
            'price' => 149.99,
            'quantity' => 50,
        ], $auth['headers']);

        $response->assertStatus(200)
                 ->assertJson(['success' => true]);

        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'name' => 'Updated Product Name',
            'price' => 149.99,
        ]);
    }

    /** @test */
    public function admin_can_delete_product()
    {
        $auth = $this->authenticateAdmin();
        $product = Product::factory()->create();

        $response = $this->deleteJson("/api/v1/admin/products/{$product->id}", [], $auth['headers']);

        $response->assertStatus(200)
                 ->assertJson(['success' => true]);

        $this->assertDatabaseMissing('products', [
            'id' => $product->id,
        ]);
    }

    /** @test */
    public function customer_cannot_create_product()
    {
        $auth = $this->authenticateUser('CUSTOMER');

        $response = $this->postJson('/api/v1/admin/products', [
            'name' => 'New Product',
            'price' => 99.99,
        ], $auth['headers']);

        $response->assertStatus(403);
    }

    /** @test */
    public function product_creation_validates_required_fields()
    {
        $auth = $this->authenticateAdmin();

        $response = $this->postJson('/api/v1/admin/products', [], $auth['headers']);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors(['name', 'price', 'sku', 'quantity']);
    }

    /** @test */
    public function product_slug_is_automatically_generated()
    {
        $auth = $this->authenticateAdmin();

        $response = $this->postJson('/api/v1/admin/products', [
            'name' => 'Test Product Name',
            'description' => 'Description',
            'price' => 99.99,
            'sku' => 'SKU-12345',
            'quantity' => 100,
            'status' => 'ACTIVE',
        ], $auth['headers']);

        $response->assertStatus(201);

        $this->assertDatabaseHas('products', [
            'name' => 'Test Product Name',
            'slug' => 'test-product-name',
        ]);
    }

    /** @test */
    public function out_of_stock_products_are_marked_correctly()
    {
        $product = Product::factory()->outOfStock()->create();

        $response = $this->getJson("/api/v1/products/{$product->slug}");

        $response->assertStatus(200)
                 ->assertJson([
                     'product' => [
                         'quantity' => 0,
                         'status' => 'OUT_OF_STOCK',
                     ],
                 ]);
    }

    /** @test */
    public function featured_products_can_be_retrieved()
    {
        Product::factory()->featured()->count(3)->create(['status' => 'ACTIVE']);
        Product::factory()->count(5)->create(['status' => 'ACTIVE', 'is_featured' => false]);

        $response = $this->getJson('/api/v1/products/featured');

        $response->assertStatus(200);
        $products = $response->json('products');
        
        $this->assertCount(3, $products);
        foreach ($products as $product) {
            $this->assertTrue($product['is_featured']);
        }
    }

    /** @test */
    public function admin_can_bulk_update_product_status()
    {
        $auth = $this->authenticateAdmin();
        $products = Product::factory()->count(3)->create();
        $productIds = $products->pluck('id')->toArray();

        $response = $this->postJson('/api/v1/admin/products/bulk-update-status', [
            'product_ids' => $productIds,
            'status' => 'INACTIVE',
        ], $auth['headers']);

        $response->assertStatus(200)
                 ->assertJson(['success' => true]);

        foreach ($productIds as $id) {
            $this->assertDatabaseHas('products', [
                'id' => $id,
                'status' => 'INACTIVE',
            ]);
        }
    }
}
