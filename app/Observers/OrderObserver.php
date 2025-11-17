<?php

namespace App\Observers;

use App\Models\Order;
use App\Services\AffiliateService;

class OrderObserver
{
    private AffiliateService $affiliateService;

    public function __construct(AffiliateService $affiliateService)
    {
        $this->affiliateService = $affiliateService;
    }

    /**
     * Handle the Order "updated" event.
     */
    public function updated(Order $order): void
    {
        // Check if order status changed to 'delivered'
        if ($order->isDirty('status') && $order->status === 'delivered') {
            // Calculate and create commissions
            $this->affiliateService->calculateCommission($order);
        }

        // Check if order status changed to 'cancelled' or 'refunded'
        if ($order->isDirty('status') && in_array($order->status, ['cancelled', 'refunded'])) {
            // Cancel any pending or approved commissions
            $commissions = $order->commissions()->whereIn('status', ['pending', 'approved'])->get();
            
            foreach ($commissions as $commission) {
                $this->affiliateService->cancelCommission($commission);
            }
        }
    }

    /**
     * Handle the Order "created" event.
     */
    public function created(Order $order): void
    {
        // If order is created with 'delivered' status (unlikely but possible)
        if ($order->status === 'delivered') {
            $this->affiliateService->calculateCommission($order);
        }
    }
}
