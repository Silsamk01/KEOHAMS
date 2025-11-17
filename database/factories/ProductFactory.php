<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        return [
            'name' => fake()->words(3, true),
            'slug' => fake()->unique()->slug(),
            'description' => fake()->paragraph(5),
            'short_description' => fake()->sentence(),
            'price' => fake()->randomFloat(2, 10, 1000),
            'compare_price' => fake()->optional()->randomFloat(2, 15, 1200),
            'cost_price' => fake()->randomFloat(2, 5, 800),
            'sku' => strtoupper(fake()->unique()->bothify('SKU-####-????')),
            'barcode' => fake()->optional()->ean13(),
            'quantity' => fake()->numberBetween(0, 500),
            'low_stock_threshold' => 10,
            'weight' => fake()->optional()->randomFloat(2, 0.1, 50),
            'length' => fake()->optional()->randomFloat(2, 1, 100),
            'width' => fake()->optional()->randomFloat(2, 1, 100),
            'height' => fake()->optional()->randomFloat(2, 1, 100),
            'category_id' => null,
            'brand_id' => null,
            'status' => 'ACTIVE',
            'is_featured' => fake()->boolean(20),
            'is_new' => fake()->boolean(30),
            'requires_shipping' => true,
            'is_taxable' => true,
            'tax_rate' => 0,
            'meta_title' => fake()->sentence(),
            'meta_description' => fake()->sentence(),
            'meta_keywords' => implode(',', fake()->words(5)),
            'created_by' => User::factory(),
        ];
    }

    public function outOfStock()
    {
        return $this->state(fn (array $attributes) => [
            'quantity' => 0,
            'status' => 'OUT_OF_STOCK',
        ]);
    }

    public function lowStock()
    {
        return $this->state(fn (array $attributes) => [
            'quantity' => 5,
        ]);
    }

    public function featured()
    {
        return $this->state(fn (array $attributes) => [
            'is_featured' => true,
        ]);
    }

    public function inactive()
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'INACTIVE',
        ]);
    }

    public function draft()
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'DRAFT',
        ]);
    }
}
