<?php

namespace App\Http\Controllers;

use App\Models\BlogPost;
use App\Models\Tag;
use App\Models\ActivityLog;
use App\Services\BlogService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class BlogController extends Controller
{
    private BlogService $blogService;

    public function __construct(BlogService $blogService)
    {
        $this->blogService = $blogService;
    }
    /**
     * Get all published blog posts (public)
     */
    public function index(Request $request)
    {
        $query = BlogPost::with(['tags'])
            ->published();

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('title', 'LIKE', "%{$search}%")
                  ->orWhere('excerpt', 'LIKE', "%{$search}%")
                  ->orWhere('content', 'LIKE', "%{$search}%");
            });
        }

        // Filter by category
        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        // Filter by tag
        if ($request->has('tag')) {
            $query->whereHas('tags', function($q) use ($request) {
                $q->where('slug', $request->tag);
            });
        }

        $posts = $query->orderBy('published_at', 'desc')
            ->paginate(12);

        return response()->json($posts);
    }

    /**
     * Get single blog post by slug (public)
     */
    public function show($slug)
    {
        $post = BlogPost::with(['tags'])
            ->where('slug', $slug)
            ->published()
            ->firstOrFail();

        // Increment view count
        $post->incrementViewCount();

        return response()->json($post);
    }

    /**
     * Get featured posts (public)
     */
    public function featured()
    {
        $posts = BlogPost::with(['tags'])
            ->published()
            ->where('is_featured', true)
            ->orderBy('published_at', 'desc')
            ->limit(5)
            ->get();

        return response()->json($posts);
    }

    /**
     * Get all posts (Admin - includes drafts)
     */
    public function adminIndex(Request $request)
    {
        $query = BlogPost::with(['tags']);

        // Filter by status
        if ($request->has('status')) {
            if ($request->status === 'PUBLISHED') {
                $query->published();
            } elseif ($request->status === 'DRAFT') {
                $query->whereNull('published_at');
            }
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('title', 'LIKE', "%{$search}%")
                  ->orWhere('excerpt', 'LIKE', "%{$search}%");
            });
        }

        $posts = $query->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($posts);
    }

    /**
     * Create blog post (Admin only)
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'slug' => 'required|string|unique:blog_posts,slug',
            'excerpt' => 'nullable|string',
            'content' => 'required|string',
            'cover_image' => 'nullable|string',
            'category' => 'nullable|string|max:100',
            'tags' => 'nullable|array',
            'tags.*' => 'string',
            'seo_title' => 'nullable|string|max:255',
            'seo_description' => 'nullable|string',
            'reading_minutes' => 'nullable|integer',
            'is_featured' => 'boolean',
            'published_at' => 'nullable|date',
        ]);

        $post = BlogPost::create([
            'title' => $validated['title'],
            'slug' => $validated['slug'],
            'excerpt' => $validated['excerpt'] ?? Str::limit(strip_tags($validated['content']), 200),
            'content' => $validated['content'],
            'cover_image' => $validated['cover_image'] ?? null,
            'category' => $validated['category'] ?? null,
            'seo_title' => $validated['seo_title'] ?? $validated['title'],
            'seo_description' => $validated['seo_description'] ?? null,
            'reading_minutes' => $validated['reading_minutes'] ?? null,
            'is_featured' => $validated['is_featured'] ?? false,
            'published_at' => $validated['published_at'] ?? null,
        ]);

        // Attach tags
        if (!empty($validated['tags'])) {
            $tagIds = [];
            foreach ($validated['tags'] as $tagName) {
                $tag = Tag::firstOrCreate(
                    ['slug' => Str::slug($tagName)],
                    ['name' => $tagName]
                );
                $tagIds[] = $tag->id;
            }
            $post->tags()->sync($tagIds);
        }

        ActivityLog::log('BLOG_POST_CREATED', $request->user()->id, 'Blog post created', [
            'post_id' => $post->id,
            'title' => $post->title,
        ]);

        return response()->json([
            'message' => 'Blog post created successfully.',
            'post' => $post->load('tags')
        ], 201);
    }

    /**
     * Update blog post (Admin only)
     */
    public function update(Request $request, $id)
    {
        $post = BlogPost::findOrFail($id);

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'slug' => 'sometimes|string|unique:blog_posts,slug,' . $id,
            'excerpt' => 'nullable|string',
            'content' => 'sometimes|string',
            'cover_image' => 'nullable|string',
            'category' => 'nullable|string|max:100',
            'tags' => 'nullable|array',
            'tags.*' => 'string',
            'seo_title' => 'nullable|string|max:255',
            'seo_description' => 'nullable|string',
            'reading_minutes' => 'nullable|integer',
            'is_featured' => 'boolean',
            'published_at' => 'nullable|date',
        ]);

        $post->update($validated);

        // Update tags
        if (isset($validated['tags'])) {
            $tagIds = [];
            foreach ($validated['tags'] as $tagName) {
                $tag = Tag::firstOrCreate(
                    ['slug' => Str::slug($tagName)],
                    ['name' => $tagName]
                );
                $tagIds[] = $tag->id;
            }
            $post->tags()->sync($tagIds);
        }

        ActivityLog::log('BLOG_POST_UPDATED', $request->user()->id, 'Blog post updated', [
            'post_id' => $post->id,
            'title' => $post->title,
        ]);

        return response()->json([
            'message' => 'Blog post updated successfully.',
            'post' => $post->load('tags')
        ]);
    }

    /**
     * Delete blog post (Admin only)
     */
    public function destroy(Request $request, $id)
    {
        $post = BlogPost::findOrFail($id);

        ActivityLog::log('BLOG_POST_DELETED', $request->user()->id, 'Blog post deleted', [
            'post_id' => $post->id,
            'title' => $post->title,
        ]);

        $post->delete();

        return response()->json(['message' => 'Blog post deleted successfully.']);
    }

    /**
     * Publish blog post (Admin only)
     */
    public function publish(Request $request, $id)
    {
        $post = BlogPost::findOrFail($id);

        if ($post->published_at) {
            return response()->json(['message' => 'Post already published.'], 400);
        }

        $post->update(['published_at' => now()]);

        ActivityLog::log('BLOG_POST_PUBLISHED', $request->user()->id, 'Blog post published', [
            'post_id' => $post->id,
            'title' => $post->title,
        ]);

        return response()->json([
            'message' => 'Blog post published successfully.',
            'post' => $post
        ]);
    }

    /**
     * Unpublish blog post (Admin only)
     */
    public function unpublish(Request $request, $id)
    {
        $post = BlogPost::findOrFail($id);

        $post->update(['published_at' => null]);

        ActivityLog::log('BLOG_POST_UNPUBLISHED', $request->user()->id, 'Blog post unpublished', [
            'post_id' => $post->id,
            'title' => $post->title,
        ]);

        return response()->json([
            'message' => 'Blog post unpublished successfully.',
            'post' => $post
        ]);
    }

    /**
     * Get all tags
     */
    public function tags()
    {
        $tags = Tag::withCount('posts')
            ->orderBy('posts_count', 'desc')
            ->get();

        return response()->json($tags);
    }

    /**
     * Get all categories
     */
    public function categories()
    {
        try {
            $categories = $this->blogService->getCategories();
            return response()->json(['success' => true, 'data' => $categories]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve categories.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get blog statistics (Admin only)
     */
    public function statistics(Request $request)
    {
        try {
            $stats = $this->blogService->getStatistics();
            return response()->json(['success' => true, 'data' => $stats]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve statistics.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get popular posts
     */
    public function popular(Request $request)
    {
        try {
            $days = $request->input('days', 30);
            $limit = $request->input('limit', 5);
            $posts = $this->blogService->getPopularPosts($days, $limit);
            return response()->json(['success' => true, 'data' => $posts]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve popular posts.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get recent posts
     */
    public function recent(Request $request)
    {
        try {
            $limit = $request->input('limit', 5);
            $posts = $this->blogService->getRecentPosts($limit);
            return response()->json(['success' => true, 'data' => $posts]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve recent posts.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get related posts
     */
    public function related($id, Request $request)
    {
        try {
            $limit = $request->input('limit', 3);
            $posts = $this->blogService->getRelatedPosts($id, $limit);
            return response()->json(['success' => true, 'data' => $posts]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve related posts.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Search posts
     */
    public function search(Request $request)
    {
        try {
            $query = $request->input('q', '');
            $perPage = $request->input('per_page', 12);
            
            if (empty($query)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Search query is required.'
                ], 400);
            }

            $results = $this->blogService->searchPosts($query, $perPage);
            return response()->json(['success' => true, 'data' => $results]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Search failed.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Upload cover image (Admin only)
     */
    public function uploadCoverImage(Request $request)
    {
        try {
            $request->validate([
                'image' => 'required|image|mimes:jpeg,png,jpg,gif,webp|max:5120', // 5MB max
            ]);

            $path = $this->blogService->uploadCoverImage($request->file('image'));

            ActivityLog::log('BLOG_IMAGE_UPLOADED', $request->user()->id, 'Blog cover image uploaded', [
                'path' => $path,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Image uploaded successfully.',
                'data' => [
                    'path' => $path,
                    'url' => asset('storage/' . $path)
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Image upload failed.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Toggle featured status (Admin only)
     */
    public function toggleFeatured(Request $request, $id)
    {
        try {
            $post = $this->blogService->toggleFeatured($id);

            ActivityLog::log('BLOG_POST_FEATURED_TOGGLED', $request->user()->id, 'Blog post featured status toggled', [
                'post_id' => $post->id,
                'is_featured' => $post->is_featured,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Featured status updated successfully.',
                'data' => $post
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update featured status.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Bulk operations (Admin only)
     */
    public function bulkAction(Request $request)
    {
        try {
            $validated = $request->validate([
                'action' => 'required|in:publish,unpublish,delete',
                'post_ids' => 'required|array',
                'post_ids.*' => 'integer|exists:posts,id',
            ]);

            $action = $validated['action'];
            $postIds = $validated['post_ids'];

            switch ($action) {
                case 'publish':
                    $this->blogService->bulkPublish($postIds);
                    $message = 'Posts published successfully.';
                    break;
                case 'unpublish':
                    $this->blogService->bulkUnpublish($postIds);
                    $message = 'Posts unpublished successfully.';
                    break;
                case 'delete':
                    $this->blogService->bulkDelete($postIds);
                    $message = 'Posts deleted successfully.';
                    break;
            }

            ActivityLog::log('BLOG_BULK_ACTION', $request->user()->id, "Bulk {$action} performed", [
                'action' => $action,
                'count' => count($postIds),
            ]);

            return response()->json([
                'success' => true,
                'message' => $message
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Bulk action failed.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get posts by category
     */
    public function byCategory($category, Request $request)
    {
        try {
            $perPage = $request->input('per_page', 12);
            $posts = $this->blogService->getPostsByCategory($category, $perPage);
            return response()->json(['success' => true, 'data' => $posts]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve posts.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get posts by tag
     */
    public function byTag($tagSlug, Request $request)
    {
        try {
            $perPage = $request->input('per_page', 12);
            $posts = $this->blogService->getPostsByTag($tagSlug, $perPage);
            return response()->json(['success' => true, 'data' => $posts]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve posts.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Generate sitemap (Public)
     */
    public function sitemap()
    {
        try {
            $posts = $this->blogService->getSitemapData();
            return response()->view('sitemap', ['posts' => $posts])
                ->header('Content-Type', 'application/xml');
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate sitemap.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Generate RSS feed (Public)
     */
    public function rss()
    {
        try {
            $posts = $this->blogService->getRSSFeedData();
            return response()->view('rss', ['posts' => $posts])
                ->header('Content-Type', 'application/rss+xml');
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate RSS feed.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Clear blog cache (Admin only)
     */
    public function clearCache(Request $request)
    {
        try {
            $this->blogService->clearCache();

            ActivityLog::log('BLOG_CACHE_CLEARED', $request->user()->id, 'Blog cache cleared');

            return response()->json([
                'success' => true,
                'message' => 'Blog cache cleared successfully.'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to clear cache.',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
