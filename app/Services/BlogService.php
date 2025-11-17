<?php

namespace App\Services;

use App\Models\BlogPost;
use App\Models\Tag;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class BlogService
{
    /**
     * Get paginated blog posts with filters
     */
    public function getPosts(array $filters = [], int $perPage = 12)
    {
        $query = BlogPost::with(['tags', 'author']);

        // Apply filters
        if (isset($filters['status'])) {
            if ($filters['status'] === 'published') {
                $query->published();
            } elseif ($filters['status'] === 'draft') {
                $query->draft();
            }
        } else {
            // Default to published for public access
            $query->published();
        }

        if (!empty($filters['search'])) {
            $query->search($filters['search']);
        }

        if (!empty($filters['category'])) {
            $query->byCategory($filters['category']);
        }

        if (!empty($filters['tag'])) {
            $query->byTag($filters['tag']);
        }

        if (isset($filters['featured']) && $filters['featured']) {
            $query->featured();
        }

        // Sorting
        $sortBy = $filters['sort_by'] ?? 'published_at';
        $sortOrder = $filters['sort_order'] ?? 'desc';
        
        if ($sortBy === 'popular') {
            $query->orderBy('view_count', 'desc');
        } elseif ($sortBy === 'title') {
            $query->orderBy('title', $sortOrder);
        } else {
            $query->orderBy($sortBy, $sortOrder);
        }

        return $query->paginate($perPage);
    }

    /**
     * Get single post by slug
     */
    public function getPostBySlug(string $slug, bool $incrementView = true)
    {
        $post = BlogPost::with(['tags', 'author'])
            ->where('slug', $slug)
            ->firstOrFail();

        if ($incrementView && $post->is_published) {
            $post->incrementViewCount();
        }

        return $post;
    }

    /**
     * Get post by ID
     */
    public function getPostById(int $id)
    {
        return BlogPost::with(['tags', 'author'])->findOrFail($id);
    }

    /**
     * Create new blog post
     */
    public function createPost(array $data, ?User $author = null)
    {
        DB::beginTransaction();
        try {
            // Generate unique slug
            if (empty($data['slug'])) {
                $data['slug'] = BlogPost::generateUniqueSlug($data['title']);
            } else {
                $data['slug'] = BlogPost::generateUniqueSlug($data['slug']);
            }

            // Auto-generate excerpt if not provided
            if (empty($data['excerpt']) && !empty($data['content'])) {
                $data['excerpt'] = Str::limit(strip_tags($data['content']), 200);
            }

            // Calculate reading time if not provided
            if (empty($data['reading_minutes']) && !empty($data['content'])) {
                $data['reading_minutes'] = BlogPost::calculateReadingTime($data['content']);
            }

            // Set SEO title if not provided
            if (empty($data['seo_title'])) {
                $data['seo_title'] = $data['title'];
            }

            // Set status
            if (!isset($data['status'])) {
                $data['status'] = 'DRAFT';
            }

            // Set author
            if ($author) {
                $data['author_id'] = $author->id;
            }

            // Handle published_at
            if (isset($data['publish_now']) && $data['publish_now']) {
                $data['status'] = 'PUBLISHED';
                $data['published_at'] = now();
            } elseif (!empty($data['published_at']) && $data['status'] === 'PUBLISHED') {
                // Keep the provided published_at
            } elseif ($data['status'] === 'DRAFT') {
                $data['published_at'] = null;
            }

            // Create post
            $post = BlogPost::create($data);

            // Sync tags
            if (!empty($data['tags'])) {
                $this->syncTags($post, $data['tags']);
            }

            DB::commit();

            // Clear cache
            $this->clearCache();

            return $post->load(['tags', 'author']);
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Update blog post
     */
    public function updatePost(int $id, array $data)
    {
        DB::beginTransaction();
        try {
            $post = BlogPost::findOrFail($id);

            // Update slug if title changed
            if (!empty($data['title']) && $data['title'] !== $post->title) {
                $data['slug'] = BlogPost::generateUniqueSlug($data['title'], $id);
            } elseif (!empty($data['slug']) && $data['slug'] !== $post->slug) {
                $data['slug'] = BlogPost::generateUniqueSlug($data['slug'], $id);
            }

            // Recalculate reading time if content changed
            if (isset($data['content']) && $data['content'] !== $post->content) {
                if (empty($data['reading_minutes'])) {
                    $data['reading_minutes'] = BlogPost::calculateReadingTime($data['content']);
                }
            }

            // Handle status changes
            if (isset($data['status']) && $data['status'] === 'PUBLISHED') {
                if (!$post->published_at && empty($data['published_at'])) {
                    $data['published_at'] = now();
                }
            } elseif (isset($data['status']) && $data['status'] === 'DRAFT') {
                $data['published_at'] = null;
            }

            $post->update($data);

            // Sync tags if provided
            if (isset($data['tags'])) {
                $this->syncTags($post, $data['tags']);
            }

            DB::commit();

            // Clear cache
            $this->clearCache();

            return $post->load(['tags', 'author']);
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Delete blog post
     */
    public function deletePost(int $id)
    {
        $post = BlogPost::findOrFail($id);
        $post->delete();

        // Clear cache
        $this->clearCache();

        return true;
    }

    /**
     * Publish post
     */
    public function publishPost(int $id, $publishedAt = null)
    {
        $post = BlogPost::findOrFail($id);

        if ($post->is_published) {
            throw new \Exception('Post is already published.');
        }

        $post->update([
            'status' => 'PUBLISHED',
            'published_at' => $publishedAt ?? now(),
        ]);

        // Clear cache
        $this->clearCache();

        return $post;
    }

    /**
     * Unpublish post
     */
    public function unpublishPost(int $id)
    {
        $post = BlogPost::findOrFail($id);

        $post->update([
            'status' => 'DRAFT',
            'published_at' => null,
        ]);

        // Clear cache
        $this->clearCache();

        return $post;
    }

    /**
     * Toggle featured status
     */
    public function toggleFeatured(int $id)
    {
        $post = BlogPost::findOrFail($id);
        $post->toggleFeature();

        // Clear cache
        $this->clearCache();

        return $post;
    }

    /**
     * Get featured posts
     */
    public function getFeaturedPosts(int $limit = 5)
    {
        return Cache::remember('blog:featured:' . $limit, 3600, function () use ($limit) {
            return BlogPost::with(['tags', 'author'])
                ->published()
                ->featured()
                ->recent($limit)
                ->get();
        });
    }

    /**
     * Get popular posts
     */
    public function getPopularPosts(int $days = 30, int $limit = 5)
    {
        return Cache::remember('blog:popular:' . $days . ':' . $limit, 3600, function () use ($days, $limit) {
            return BlogPost::with(['tags', 'author'])
                ->published()
                ->popular($days)
                ->limit($limit)
                ->get();
        });
    }

    /**
     * Get recent posts
     */
    public function getRecentPosts(int $limit = 5)
    {
        return Cache::remember('blog:recent:' . $limit, 1800, function () use ($limit) {
            return BlogPost::with(['tags', 'author'])
                ->published()
                ->recent($limit)
                ->get();
        });
    }

    /**
     * Get related posts
     */
    public function getRelatedPosts(int $postId, int $limit = 3)
    {
        $post = BlogPost::findOrFail($postId);
        return $post->getRelatedPosts($limit);
    }

    /**
     * Get all categories
     */
    public function getCategories()
    {
        return Cache::remember('blog:categories', 3600, function () {
            return BlogPost::published()
                ->whereNotNull('category')
                ->select('category', DB::raw('COUNT(*) as post_count'))
                ->groupBy('category')
                ->orderBy('post_count', 'desc')
                ->get();
        });
    }

    /**
     * Get all tags with post counts
     */
    public function getTags()
    {
        return Cache::remember('blog:tags', 3600, function () {
            return Tag::withCount(['posts' => function ($query) {
                    $query->published();
                }])
                ->having('posts_count', '>', 0)
                ->orderBy('posts_count', 'desc')
                ->get();
        });
    }

    /**
     * Get blog statistics
     */
    public function getStatistics()
    {
        return Cache::remember('blog:statistics', 1800, function () {
            return [
                'total_posts' => BlogPost::published()->count(),
                'total_drafts' => BlogPost::draft()->count(),
                'total_views' => BlogPost::published()->sum('view_count'),
                'total_categories' => BlogPost::published()->whereNotNull('category')->distinct('category')->count('category'),
                'total_tags' => Tag::withCount(['posts' => function ($query) {
                    $query->published();
                }])->having('posts_count', '>', 0)->count(),
                'featured_count' => BlogPost::published()->featured()->count(),
                'posts_this_month' => BlogPost::published()
                    ->whereYear('published_at', now()->year)
                    ->whereMonth('published_at', now()->month)
                    ->count(),
                'posts_last_month' => BlogPost::published()
                    ->whereYear('published_at', now()->subMonth()->year)
                    ->whereMonth('published_at', now()->subMonth()->month)
                    ->count(),
                'most_popular' => BlogPost::published()
                    ->orderBy('view_count', 'desc')
                    ->first(),
                'recent_posts' => BlogPost::published()
                    ->orderBy('published_at', 'desc')
                    ->limit(5)
                    ->get(['id', 'title', 'slug', 'view_count', 'published_at']),
            ];
        });
    }

    /**
     * Upload cover image
     */
    public function uploadCoverImage(UploadedFile $file, ?string $oldImage = null)
    {
        // Delete old image if exists
        if ($oldImage) {
            Storage::disk('public')->delete($oldImage);
        }

        // Store new image
        $path = $file->store('blog/covers', 'public');

        return $path;
    }

    /**
     * Delete cover image
     */
    public function deleteCoverImage(string $path)
    {
        if ($path) {
            Storage::disk('public')->delete($path);
        }
    }

    /**
     * Sync tags for a post
     */
    protected function syncTags(BlogPost $post, array $tagNames)
    {
        if (empty($tagNames)) {
            $post->tags()->detach();
            return;
        }

        $tagIds = [];
        foreach ($tagNames as $tagName) {
            if (is_string($tagName)) {
                $tag = Tag::firstOrCreate(
                    ['slug' => Str::slug($tagName)],
                    ['name' => $tagName]
                );
                $tagIds[] = $tag->id;
            } elseif (is_numeric($tagName)) {
                $tagIds[] = $tagName;
            }
        }

        $post->tags()->sync($tagIds);
    }

    /**
     * Create or update tag
     */
    public function createOrUpdateTag(array $data, ?int $id = null)
    {
        if ($id) {
            $tag = Tag::findOrFail($id);
            $tag->update($data);
            return $tag;
        }

        if (empty($data['slug'])) {
            $data['slug'] = Str::slug($data['name']);
        }

        return Tag::create($data);
    }

    /**
     * Delete tag
     */
    public function deleteTag(int $id)
    {
        $tag = Tag::findOrFail($id);
        $tag->delete();

        // Clear cache
        $this->clearCache();

        return true;
    }

    /**
     * Search posts
     */
    public function searchPosts(string $query, int $perPage = 12)
    {
        return BlogPost::with(['tags', 'author'])
            ->published()
            ->search($query)
            ->orderBy('view_count', 'desc')
            ->paginate($perPage);
    }

    /**
     * Get posts by category
     */
    public function getPostsByCategory(string $category, int $perPage = 12)
    {
        return BlogPost::with(['tags', 'author'])
            ->published()
            ->byCategory($category)
            ->orderBy('published_at', 'desc')
            ->paginate($perPage);
    }

    /**
     * Get posts by tag
     */
    public function getPostsByTag(string $tagSlug, int $perPage = 12)
    {
        return BlogPost::with(['tags', 'author'])
            ->published()
            ->byTag($tagSlug)
            ->orderBy('published_at', 'desc')
            ->paginate($perPage);
    }

    /**
     * Bulk publish posts
     */
    public function bulkPublish(array $postIds)
    {
        DB::beginTransaction();
        try {
            BlogPost::whereIn('id', $postIds)
                ->whereNull('published_at')
                ->update([
                    'status' => 'PUBLISHED',
                    'published_at' => now(),
                ]);

            DB::commit();

            // Clear cache
            $this->clearCache();

            return true;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Bulk unpublish posts
     */
    public function bulkUnpublish(array $postIds)
    {
        DB::beginTransaction();
        try {
            BlogPost::whereIn('id', $postIds)
                ->update([
                    'status' => 'DRAFT',
                    'published_at' => null,
                ]);

            DB::commit();

            // Clear cache
            $this->clearCache();

            return true;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Bulk delete posts
     */
    public function bulkDelete(array $postIds)
    {
        DB::beginTransaction();
        try {
            BlogPost::whereIn('id', $postIds)->delete();

            DB::commit();

            // Clear cache
            $this->clearCache();

            return true;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Generate sitemap data
     */
    public function getSitemapData()
    {
        return BlogPost::published()
            ->orderBy('updated_at', 'desc')
            ->get(['slug', 'updated_at', 'created_at']);
    }

    /**
     * Generate RSS feed data
     */
    public function getRSSFeedData(int $limit = 20)
    {
        return BlogPost::with(['author'])
            ->published()
            ->orderBy('published_at', 'desc')
            ->limit($limit)
            ->get();
    }

    /**
     * Clear all blog caches
     */
    public function clearCache()
    {
        Cache::forget('blog:statistics');
        Cache::forget('blog:categories');
        Cache::forget('blog:tags');
        
        // Clear featured posts cache for common limits
        foreach ([3, 5, 10] as $limit) {
            Cache::forget('blog:featured:' . $limit);
            Cache::forget('blog:recent:' . $limit);
        }

        // Clear popular posts cache
        foreach ([7, 30, 90] as $days) {
            foreach ([3, 5, 10] as $limit) {
                Cache::forget('blog:popular:' . $days . ':' . $limit);
            }
        }
    }
}
