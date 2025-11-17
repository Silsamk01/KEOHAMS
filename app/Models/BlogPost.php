<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class BlogPost extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'posts';

    protected $fillable = [
        'title',
        'slug',
        'excerpt',
        'content',
        'cover_image',
        'category',
        'seo_title',
        'seo_description',
        'reading_minutes',
        'view_count',
        'is_featured',
        'require_login',
        'status',
        'author_id',
        'published_at',
    ];

    protected $casts = [
        'is_featured' => 'boolean',
        'require_login' => 'boolean',
        'view_count' => 'integer',
        'reading_minutes' => 'integer',
        'published_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = ['is_published', 'formatted_date', 'read_time'];

    /**
     * Boot the model
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($post) {
            if (empty($post->slug)) {
                $post->slug = Str::slug($post->title);
            }
            
            if (empty($post->excerpt) && !empty($post->content)) {
                $post->excerpt = Str::limit(strip_tags($post->content), 200);
            }

            if (empty($post->reading_minutes) && !empty($post->content)) {
                $post->reading_minutes = self::calculateReadingTime($post->content);
            }

            if (empty($post->seo_title)) {
                $post->seo_title = $post->title;
            }
        });

        static::updating(function ($post) {
            if ($post->isDirty('title') && empty($post->slug)) {
                $post->slug = Str::slug($post->title);
            }

            if ($post->isDirty('content') && empty($post->reading_minutes)) {
                $post->reading_minutes = self::calculateReadingTime($post->content);
            }
        });
    }

    /**
     * Relationships
     */
    public function author()
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function tags()
    {
        return $this->belongsToMany(Tag::class, 'post_tags', 'post_id', 'tag_id')
            ->withTimestamps();
    }

    /**
     * Scopes
     */
    public function scopePublished($query)
    {
        return $query->where('status', 'PUBLISHED')
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now());
    }

    public function scopeDraft($query)
    {
        return $query->where('status', 'DRAFT')
            ->orWhereNull('published_at');
    }

    public function scopeFeatured($query)
    {
        return $query->where('is_featured', true);
    }

    public function scopeByCategory($query, $category)
    {
        return $query->where('category', $category);
    }

    public function scopeByTag($query, $tagSlug)
    {
        return $query->whereHas('tags', function ($q) use ($tagSlug) {
            $q->where('slug', $tagSlug);
        });
    }

    public function scopeSearch($query, $search)
    {
        return $query->where(function ($q) use ($search) {
            $q->where('title', 'LIKE', "%{$search}%")
                ->orWhere('excerpt', 'LIKE', "%{$search}%")
                ->orWhere('content', 'LIKE', "%{$search}%");
        });
    }

    public function scopePopular($query, $days = 30)
    {
        return $query->where('created_at', '>=', now()->subDays($days))
            ->orderBy('view_count', 'desc');
    }

    public function scopeRecent($query, $limit = 5)
    {
        return $query->orderBy('published_at', 'desc')
            ->limit($limit);
    }

    /**
     * Accessors
     */
    public function getIsPublishedAttribute()
    {
        return $this->status === 'PUBLISHED' 
            && !is_null($this->published_at) 
            && $this->published_at <= now();
    }

    public function getFormattedDateAttribute()
    {
        if (!$this->published_at) {
            return null;
        }
        return $this->published_at->format('M d, Y');
    }

    public function getReadTimeAttribute()
    {
        if ($this->reading_minutes) {
            return $this->reading_minutes . ' min read';
        }
        return null;
    }

    public function getExcerptHtmlAttribute()
    {
        return strip_tags($this->excerpt);
    }

    public function getCoverImageUrlAttribute()
    {
        if ($this->cover_image) {
            if (Str::startsWith($this->cover_image, ['http://', 'https://'])) {
                return $this->cover_image;
            }
            return asset('storage/' . $this->cover_image);
        }
        return asset('images/default-blog-cover.jpg');
    }

    /**
     * Methods
     */
    public function incrementViewCount()
    {
        $this->increment('view_count');
    }

    public function publish()
    {
        $this->update([
            'status' => 'PUBLISHED',
            'published_at' => $this->published_at ?? now(),
        ]);
    }

    public function unpublish()
    {
        $this->update([
            'status' => 'DRAFT',
            'published_at' => null,
        ]);
    }

    public function toggleFeature()
    {
        $this->update(['is_featured' => !$this->is_featured]);
    }

    public function syncTags(array $tagNames)
    {
        $tagIds = [];
        foreach ($tagNames as $tagName) {
            $tag = Tag::firstOrCreate(
                ['slug' => Str::slug($tagName)],
                ['name' => $tagName]
            );
            $tagIds[] = $tag->id;
        }
        $this->tags()->sync($tagIds);
    }

    /**
     * Static methods
     */
    public static function calculateReadingTime($content)
    {
        $wordCount = str_word_count(strip_tags($content));
        $minutes = ceil($wordCount / 200); // Average reading speed: 200 words per minute
        return max(1, $minutes);
    }

    public static function generateUniqueSlug($title, $id = null)
    {
        $slug = Str::slug($title);
        $originalSlug = $slug;
        $count = 1;

        while (static::where('slug', $slug)->where('id', '!=', $id)->exists()) {
            $slug = $originalSlug . '-' . $count;
            $count++;
        }

        return $slug;
    }

    /**
     * Get related posts
     */
    public function getRelatedPosts($limit = 3)
    {
        return static::published()
            ->where('id', '!=', $this->id)
            ->where(function ($query) {
                if ($this->category) {
                    $query->where('category', $this->category);
                }
                if ($this->tags->isNotEmpty()) {
                    $tagIds = $this->tags->pluck('id')->toArray();
                    $query->orWhereHas('tags', function ($q) use ($tagIds) {
                        $q->whereIn('tags.id', $tagIds);
                    });
                }
            })
            ->limit($limit)
            ->get();
    }
}
