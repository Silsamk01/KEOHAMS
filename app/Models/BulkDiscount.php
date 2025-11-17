<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BulkDiscount extends Model
{
    protected $fillable = ['product_id', 'min_quantity', 'discount_percentage'];

    protected $casts = [
        'min_quantity' => 'integer',
        'discount_percentage' => 'decimal:2',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
