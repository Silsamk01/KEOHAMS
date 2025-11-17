<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Wishlist extends Model
{
    protected $fillable = ['user_id', 'name', 'is_private', 'share_token'];

    protected $casts = ['is_private' => 'boolean'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function items()
    {
        return $this->hasMany(WishlistItem::class);
    }
}

class WishlistItem extends Model
{
    protected $fillable = [
        'wishlist_id', 'product_id', 'desired_quantity', 'price_when_added', 'notes'
    ];

    protected $casts = [
        'desired_quantity' => 'integer',
        'price_when_added' => 'decimal:2',
    ];

    public function wishlist()
    {
        return $this->belongsTo(Wishlist::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
