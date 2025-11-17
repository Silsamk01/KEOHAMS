<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'description',
        'moq',
        'price_per_unit',
        'currency',
        'category_id',
        'stock_quantity',
        'low_stock_threshold',
        'reorder_point',
        'reorder_quantity',
        'stock_status',
        'images',
        'videos',
        'average_rating',
        'review_count',
        'tags',
        'search_keywords',
    ];

    protected $casts = [
        'moq' => 'integer',
        'price_per_unit' => 'decimal:2',
        'stock_quantity' => 'integer',
        'low_stock_threshold' => 'integer',
        'reorder_point' => 'integer',
        'reorder_quantity' => 'integer',
        'average_rating' => 'decimal:2',
        'review_count' => 'integer',
        'images' => 'array',
        'videos' => 'array',
    ];

    // Relationships
    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function bulkDiscounts()
    {
        return $this->hasMany(BulkDiscount::class);
    }

    public function reviews()
    {
        return $this->hasMany(ProductReview::class);
    }

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function quotationItems()
    {
        return $this->hasMany(QuotationItem::class);
    }

    public function wishlistItems()
    {
        return $this->hasMany(WishlistItem::class);
    }

    public function inventoryMovements()
    {
        return $this->hasMany(InventoryMovement::class);
    }

    public function stockAlerts()
    {
        return $this->hasMany(StockAlert::class);
    }

    public function productViews()
    {
        return $this->hasMany(ProductView::class);
    }

    // Accessors
    public function getFormattedPriceAttribute()
    {
        return $this->currency . ' ' . number_format($this->price_per_unit, 2);
    }

    public function getIsInStockAttribute()
    {
        return $this->stock_status === 'IN_STOCK' && $this->stock_quantity > 0;
    }

    public function getIsLowStockAttribute()
    {
        return $this->stock_quantity <= $this->low_stock_threshold;
    }

    public function getFirstImageAttribute()
    {
        return !empty($this->images) ? $this->images[0] : null;
    }

    // Scopes
    public function scopeInStock($query)
    {
        return $query->where('stock_status', 'IN_STOCK')
                     ->where('stock_quantity', '>', 0);
    }

    public function scopeByCategory($query, $categoryId)
    {
        return $query->where('category_id', $categoryId);
    }

    public function scopeSearch($query, $searchTerm)
    {
        // Sanitize search term to prevent SQL injection
        $searchTerm = preg_replace('/[^\w\s\-]/', '', $searchTerm);
        $searchTerm = trim($searchTerm);
        
        if (empty($searchTerm)) {
            return $query;
        }
        
        return $query->whereRaw('MATCH(title, description) AGAINST(? IN BOOLEAN MODE)', [$searchTerm]);
    }

    // Helper methods
    public function updateStockQuantity($quantity)
    {
        $this->stock_quantity = $quantity;
        
        if ($quantity === 0) {
            $this->stock_status = 'OUT_OF_STOCK';
        } elseif ($quantity <= $this->low_stock_threshold) {
            $this->stock_status = 'LOW_STOCK';
        } else {
            $this->stock_status = 'IN_STOCK';
        }
        
        $this->save();
    }

    public function decrementStock($quantity)
    {
        $newQuantity = max(0, $this->stock_quantity - $quantity);
        $this->updateStockQuantity($newQuantity);
    }

    public function incrementStock($quantity)
    {
        $newQuantity = $this->stock_quantity + $quantity;
        $this->updateStockQuantity($newQuantity);
    }
}
