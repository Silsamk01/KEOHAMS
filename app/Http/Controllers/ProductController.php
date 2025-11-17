<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Category;
use App\Models\ActivityLog;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    /**
     * Get all products with filtering, search, and pagination
     */
    public function index(Request $request)
    {
        $query = Product::with(['category', 'bulkDiscounts'])
            ->inStock();

        // Search
        if ($request->has('search')) {
            $query->search($request->search);
        }

        // Filter by category
        if ($request->has('category_id')) {
            $query->byCategory($request->category_id);
        }

        // Filter by price range
        if ($request->has('min_price')) {
            $query->where('price_per_unit', '>=', $request->min_price);
        }
        if ($request->has('max_price')) {
            $query->where('price_per_unit', '<=', $request->max_price);
        }

        // Sort
        $sortBy = $request->input('sort_by', 'created_at');
        $sortOrder = $request->input('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        $perPage = $request->input('per_page', 20);
        $products = $query->paginate($perPage);

        return response()->json($products);
    }

    /**
     * Get single product by ID
     */
    public function show($id)
    {
        $product = Product::with(['category', 'bulkDiscounts', 'reviews.user'])
            ->findOrFail($id);

        // Increment view count
        $product->increment('view_count');

        return response()->json($product);
    }

    /**
     * Get single product by slug
     */
    public function showBySlug($slug)
    {
        $product = Product::with(['category', 'bulkDiscounts', 'reviews.user'])
            ->where('slug', $slug)
            ->firstOrFail();

        // Increment view count
        $product->increment('view_count');

        return response()->json($product);
    }

    /**
     * Create new product (Admin only)
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|unique:products,slug',
            'description' => 'nullable|string',
            'category_id' => 'required|exists:categories,id',
            'sku' => 'required|string|unique:products,sku',
            'price_per_unit' => 'required|numeric|min:0',
            'moq' => 'required|integer|min:1',
            'stock_quantity' => 'required|integer|min:0',
            'reorder_level' => 'nullable|integer|min:0',
            'max_order_quantity' => 'nullable|integer',
            'images' => 'nullable|array',
            'videos' => 'nullable|array',
            'weight' => 'nullable|numeric',
            'dimensions' => 'nullable|string',
            'shipping_class' => 'nullable|string',
            'featured' => 'boolean',
            'status' => 'required|in:ACTIVE,INACTIVE,OUT_OF_STOCK,DISCONTINUED',
        ]);

        $product = Product::create($validated);

        ActivityLog::log('PRODUCT_CREATED', $request->user()->id, 'Product created', [
            'product_id' => $product->id,
            'name' => $product->name,
        ]);

        return response()->json([
            'message' => 'Product created successfully.',
            'product' => $product
        ], 201);
    }

    /**
     * Update product (Admin only)
     */
    public function update(Request $request, $id)
    {
        $product = Product::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'slug' => 'sometimes|string|unique:products,slug,' . $id,
            'description' => 'nullable|string',
            'category_id' => 'sometimes|exists:categories,id',
            'sku' => 'sometimes|string|unique:products,sku,' . $id,
            'price_per_unit' => 'sometimes|numeric|min:0',
            'moq' => 'sometimes|integer|min:1',
            'stock_quantity' => 'sometimes|integer|min:0',
            'reorder_level' => 'nullable|integer|min:0',
            'max_order_quantity' => 'nullable|integer',
            'images' => 'nullable|array',
            'videos' => 'nullable|array',
            'weight' => 'nullable|numeric',
            'dimensions' => 'nullable|string',
            'shipping_class' => 'nullable|string',
            'featured' => 'boolean',
            'status' => 'sometimes|in:ACTIVE,INACTIVE,OUT_OF_STOCK,DISCONTINUED',
        ]);

        $product->update($validated);

        ActivityLog::log('PRODUCT_UPDATED', $request->user()->id, 'Product updated', [
            'product_id' => $product->id,
            'name' => $product->name,
        ]);

        return response()->json([
            'message' => 'Product updated successfully.',
            'product' => $product
        ]);
    }

    /**
     * Delete product (Admin only)
     */
    public function destroy(Request $request, $id)
    {
        $product = Product::findOrFail($id);

        ActivityLog::log('PRODUCT_DELETED', $request->user()->id, 'Product deleted', [
            'product_id' => $product->id,
            'name' => $product->name,
        ]);

        $product->delete();

        return response()->json(['message' => 'Product deleted successfully.']);
    }

    /**
     * Update stock quantity (Admin only)
     */
    public function updateStock(Request $request, $id)
    {
        $validated = $request->validate([
            'quantity' => 'required|integer',
            'type' => 'required|in:SET,INCREMENT,DECREMENT',
            'reason' => 'nullable|string',
        ]);

        $product = Product::findOrFail($id);
        $oldQuantity = $product->stock_quantity;

        switch ($validated['type']) {
            case 'SET':
                $product->updateStockQuantity($validated['quantity']);
                break;
            case 'INCREMENT':
                $product->incrementStock($validated['quantity']);
                break;
            case 'DECREMENT':
                $product->decrementStock($validated['quantity']);
                break;
        }

        ActivityLog::log('PRODUCT_STOCK_UPDATED', $request->user()->id, 'Product stock updated', [
            'product_id' => $product->id,
            'old_quantity' => $oldQuantity,
            'new_quantity' => $product->stock_quantity,
            'type' => $validated['type'],
            'reason' => $validated['reason'] ?? null,
        ]);

        return response()->json([
            'message' => 'Stock updated successfully.',
            'product' => $product
        ]);
    }

    /**
     * Get featured products
     */
    public function featured()
    {
        $products = Product::with(['category'])
            ->where('featured', true)
            ->inStock()
            ->limit(10)
            ->get();

        return response()->json($products);
    }

    /**
     * Get related products
     */
    public function related($id)
    {
        $product = Product::findOrFail($id);

        $relatedProducts = Product::with(['category'])
            ->where('category_id', $product->category_id)
            ->where('id', '!=', $id)
            ->inStock()
            ->limit(8)
            ->get();

        return response()->json($relatedProducts);
    }

    /**
     * Get low stock products (Admin only)
     */
    public function lowStock()
    {
        $products = Product::with(['category'])
            ->whereColumn('stock_quantity', '<=', 'reorder_level')
            ->orderBy('stock_quantity', 'asc')
            ->get();

        return response()->json($products);
    }
}
