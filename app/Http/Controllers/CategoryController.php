<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\ActivityLog;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    /**
     * Get all categories (tree structure)
     */
    public function index()
    {
        $categories = Category::with(['children', 'products'])
            ->whereNull('parent_id')
            ->orderBy('sort_order')
            ->get();

        return response()->json($categories);
    }

    /**
     * Get flat list of all categories
     */
    public function flat()
    {
        $categories = Category::withCount('products')
            ->orderBy('sort_order')
            ->get();

        return response()->json($categories);
    }

    /**
     * Get single category
     */
    public function show($id)
    {
        $category = Category::with(['parent', 'children', 'products'])
            ->findOrFail($id);

        return response()->json($category);
    }

    /**
     * Get category by slug
     */
    public function showBySlug($slug)
    {
        $category = Category::with(['parent', 'children', 'products'])
            ->where('slug', $slug)
            ->firstOrFail();

        return response()->json($category);
    }

    /**
     * Create category (Admin only)
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|unique:categories,slug',
            'description' => 'nullable|string',
            'parent_id' => 'nullable|exists:categories,id',
            'icon' => 'nullable|string',
            'image_url' => 'nullable|string',
            'sort_order' => 'nullable|integer',
            'is_active' => 'boolean',
        ]);

        $category = Category::create($validated);

        ActivityLog::log('CATEGORY_CREATED', $request->user()->id, 'Category created', [
            'category_id' => $category->id,
            'name' => $category->name,
        ]);

        return response()->json([
            'message' => 'Category created successfully.',
            'category' => $category
        ], 201);
    }

    /**
     * Update category (Admin only)
     */
    public function update(Request $request, $id)
    {
        $category = Category::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'slug' => 'sometimes|string|unique:categories,slug,' . $id,
            'description' => 'nullable|string',
            'parent_id' => 'nullable|exists:categories,id',
            'icon' => 'nullable|string',
            'image_url' => 'nullable|string',
            'sort_order' => 'nullable|integer',
            'is_active' => 'boolean',
        ]);

        // Prevent setting itself as parent
        if (isset($validated['parent_id']) && $validated['parent_id'] == $id) {
            return response()->json(['message' => 'Category cannot be its own parent.'], 400);
        }

        $category->update($validated);

        ActivityLog::log('CATEGORY_UPDATED', $request->user()->id, 'Category updated', [
            'category_id' => $category->id,
            'name' => $category->name,
        ]);

        return response()->json([
            'message' => 'Category updated successfully.',
            'category' => $category
        ]);
    }

    /**
     * Delete category (Admin only)
     */
    public function destroy(Request $request, $id)
    {
        $category = Category::findOrFail($id);

        // Check if category has products
        if ($category->products()->count() > 0) {
            return response()->json([
                'message' => 'Cannot delete category with associated products.'
            ], 400);
        }

        // Check if category has children
        if ($category->children()->count() > 0) {
            return response()->json([
                'message' => 'Cannot delete category with subcategories.'
            ], 400);
        }

        ActivityLog::log('CATEGORY_DELETED', $request->user()->id, 'Category deleted', [
            'category_id' => $category->id,
            'name' => $category->name,
        ]);

        $category->delete();

        return response()->json(['message' => 'Category deleted successfully.']);
    }

    /**
     * Get category tree (recursive)
     */
    public function tree()
    {
        $categories = Category::with('children.children.children')
            ->whereNull('parent_id')
            ->orderBy('sort_order')
            ->get();

        return response()->json($categories);
    }

    /**
     * Get products by category
     */
    public function products($id, Request $request)
    {
        $category = Category::findOrFail($id);

        $query = $category->products()
            ->with(['category', 'bulkDiscounts'])
            ->where('status', 'ACTIVE');

        // Sort
        $sortBy = $request->input('sort_by', 'created_at');
        $sortOrder = $request->input('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        $perPage = $request->input('per_page', 20);
        $products = $query->paginate($perPage);

        return response()->json($products);
    }
}
