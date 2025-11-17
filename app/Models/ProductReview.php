<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductReview extends Model
{
    protected $fillable = [
        'product_id', 'user_id', 'order_id', 'rating', 'title', 'review_text',
        'is_verified_purchase', 'is_approved', 'approved_by', 'approved_at',
        'helpful_count', 'unhelpful_count'
    ];

    protected $casts = [
        'rating' => 'integer',
        'is_verified_purchase' => 'boolean',
        'is_approved' => 'boolean',
        'approved_at' => 'datetime',
        'helpful_count' => 'integer',
        'unhelpful_count' => 'integer',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function images()
    {
        return $this->hasMany(ReviewImage::class, 'review_id');
    }

    public function votes()
    {
        return $this->hasMany(ReviewVote::class, 'review_id');
    }

    public function scopeApproved($query)
    {
        return $query->where('is_approved', true);
    }
}
