<?php

namespace App\Jobs;

use App\Models\Order;
use App\Models\User;
use App\Models\AffiliateAccount;
use App\Models\AffiliateSale;
use App\Models\AffiliateCommission;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ProcessAffiliateCommission implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $order;
    public $timeout = 300;
    public $tries = 3;

    /**
     * Create a new job instance
     */
    public function __construct(Order $order)
    {
        $this->order = $order;
    }

    /**
     * Execute the job
     */
    public function handle(): void
    {
        try {
            DB::beginTransaction();

            $order = $this->order->fresh(['user', 'items']);
            
            if (!$order || $order->status !== 'COMPLETED') {
                Log::info('Skipping affiliate commission: Order not completed', [
                    'order_id' => $this->order->id,
                    'status' => $order->status ?? 'not found'
                ]);
                DB::rollBack();
                return;
            }

            // Check if user has referrer
            $user = $order->user;
            if (!$user || !$user->referred_by) {
                Log::info('Skipping affiliate commission: No referrer', [
                    'order_id' => $order->id,
                    'user_id' => $user->id ?? null
                ]);
                DB::rollBack();
                return;
            }

            // Check if commission already processed
            $existingSale = AffiliateSale::where('order_id', $order->id)->first();
            if ($existingSale) {
                Log::info('Skipping affiliate commission: Already processed', [
                    'order_id' => $order->id,
                    'sale_id' => $existingSale->id
                ]);
                DB::rollBack();
                return;
            }

            // Get affiliate account
            $affiliate = AffiliateAccount::where('user_id', $user->referred_by)
                ->where('status', 'ACTIVE')
                ->first();

            if (!$affiliate) {
                Log::info('Skipping affiliate commission: Affiliate not active', [
                    'order_id' => $order->id,
                    'referrer_id' => $user->referred_by
                ]);
                DB::rollBack();
                return;
            }

            // Calculate commission
            $orderTotal = $order->total_amount;
            $commissionRate = $affiliate->commission_rate ?? 5.0; // Default 5%
            $commissionAmount = ($orderTotal * $commissionRate) / 100;

            // Create affiliate sale
            $sale = AffiliateSale::create([
                'affiliate_id' => $affiliate->id,
                'order_id' => $order->id,
                'customer_id' => $user->id,
                'sale_amount' => $orderTotal,
                'commission_rate' => $commissionRate,
                'commission_amount' => $commissionAmount,
                'status' => 'PENDING',
                'sale_date' => now(),
            ]);

            // Process commission up the tree (MLM structure)
            $this->processUplineCommissions($affiliate, $order, $orderTotal, 1);

            // Update affiliate totals
            $affiliate->increment('total_sales', $orderTotal);
            $affiliate->increment('total_commission', $commissionAmount);
            $affiliate->increment('pending_commission', $commissionAmount);

            DB::commit();

            Log::info('Affiliate commission processed successfully', [
                'order_id' => $order->id,
                'sale_id' => $sale->id,
                'affiliate_id' => $affiliate->id,
                'commission_amount' => $commissionAmount,
            ]);

            // Send notification to affiliate
            SendNotification::dispatch(
                $affiliate->user_id,
                'New Sale Commission',
                "You earned ₦" . number_format($commissionAmount, 2) . " commission from order #{$order->id}",
                'COMMISSION',
                $sale->id,
                'sale',
                "/affiliate-dashboard"
            );

        } catch (\Exception $e) {
            DB::rollBack();
            
            Log::error('Failed to process affiliate commission', [
                'order_id' => $this->order->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            throw $e;
        }
    }

    /**
     * Process commission for upline affiliates (MLM tree)
     */
    protected function processUplineCommissions($affiliate, $order, $orderTotal, $level)
    {
        // Maximum levels to process (prevent infinite loops)
        if ($level > 5) {
            return;
        }

        // Get parent affiliate
        $user = User::find($affiliate->user_id);
        if (!$user || !$user->referred_by) {
            return;
        }

        $parentAffiliate = AffiliateAccount::where('user_id', $user->referred_by)
            ->where('status', 'ACTIVE')
            ->first();

        if (!$parentAffiliate) {
            return;
        }

        // Calculate level-based commission rate
        $levelRates = [
            1 => 5.0,  // Direct referral: 5%
            2 => 3.0,  // Second level: 3%
            3 => 2.0,  // Third level: 2%
            4 => 1.0,  // Fourth level: 1%
            5 => 0.5,  // Fifth level: 0.5%
        ];

        $commissionRate = $levelRates[$level] ?? 0;
        if ($commissionRate <= 0) {
            return;
        }

        $commissionAmount = ($orderTotal * $commissionRate) / 100;

        // Create commission record
        AffiliateCommission::create([
            'affiliate_id' => $parentAffiliate->id,
            'order_id' => $order->id,
            'level' => $level,
            'commission_rate' => $commissionRate,
            'commission_amount' => $commissionAmount,
            'status' => 'PENDING',
        ]);

        // Update parent totals
        $parentAffiliate->increment('total_commission', $commissionAmount);
        $parentAffiliate->increment('pending_commission', $commissionAmount);

        Log::info("Level {$level} commission processed", [
            'order_id' => $order->id,
            'affiliate_id' => $parentAffiliate->id,
            'commission_amount' => $commissionAmount,
        ]);

        // Send notification
        SendNotification::dispatch(
            $parentAffiliate->user_id,
            "Level {$level} Commission Earned",
            "You earned ₦" . number_format($commissionAmount, 2) . " from your level {$level} network",
            'COMMISSION',
            $order->id,
            'order',
            "/affiliate-dashboard"
        );

        // Process next level
        $this->processUplineCommissions($parentAffiliate, $order, $orderTotal, $level + 1);
    }

    /**
     * Handle job failure
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('ProcessAffiliateCommission job failed permanently', [
            'order_id' => $this->order->id,
            'error' => $exception->getMessage(),
        ]);
    }
}
