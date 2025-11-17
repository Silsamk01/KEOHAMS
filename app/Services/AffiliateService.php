<?php

namespace App\Services;

use App\Models\User;
use App\Models\AffiliateAccount;
use App\Models\Commission;
use App\Models\Order;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class AffiliateService
{
    /**
     * Register a new affiliate account
     */
    public function registerAffiliate(User $user, ?string $referralCode = null): AffiliateAccount
    {
        DB::beginTransaction();

        try {
            // Check if already has affiliate account
            if ($user->affiliateAccount) {
                throw new \Exception('User already has an affiliate account');
            }

            // Get referrer if referral code provided
            $referrer = null;
            if ($referralCode) {
                $referrer = AffiliateAccount::where('referral_code', $referralCode)
                    ->where('status', 'active')
                    ->first();

                if (!$referrer) {
                    throw new \Exception('Invalid referral code');
                }
            }

            // Create affiliate account
            $affiliate = AffiliateAccount::create([
                'user_id' => $user->id,
                'referral_code' => $this->generateUniqueReferralCode(),
                'referrer_id' => $referrer?->id,
                'status' => 'active',
                'commission_rate' => config('affiliate.default_commission_rate', 10.0),
                'total_earnings' => 0,
                'available_balance' => 0,
                'pending_balance' => 0,
                'withdrawn_amount' => 0,
                'total_referrals' => 0,
                'active_referrals' => 0,
                'level' => 1,
            ]);

            // Update referrer's referral count
            if ($referrer) {
                $referrer->increment('total_referrals');
                $referrer->increment('active_referrals');
            }

            DB::commit();

            // Clear cache
            $this->clearAffiliateCache($user->id);

            return $affiliate;

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Generate unique referral code
     */
    private function generateUniqueReferralCode(): string
    {
        do {
            $code = strtoupper(Str::random(8));
        } while (AffiliateAccount::where('referral_code', $code)->exists());

        return $code;
    }

    /**
     * Get affiliate statistics
     */
    public function getAffiliateStats(int $affiliateId): array
    {
        $cacheKey = "affiliate:stats:{$affiliateId}";

        return Cache::remember($cacheKey, 300, function () use ($affiliateId) {
            $affiliate = AffiliateAccount::findOrFail($affiliateId);

            // Get commission statistics
            $commissions = Commission::where('affiliate_id', $affiliateId);

            return [
                'overview' => [
                    'total_earnings' => $affiliate->total_earnings,
                    'available_balance' => $affiliate->available_balance,
                    'pending_balance' => $affiliate->pending_balance,
                    'withdrawn_amount' => $affiliate->withdrawn_amount,
                    'total_referrals' => $affiliate->total_referrals,
                    'active_referrals' => $affiliate->active_referrals,
                    'level' => $affiliate->level,
                    'commission_rate' => $affiliate->commission_rate,
                ],
                'commissions' => [
                    'total' => $commissions->sum('amount'),
                    'pending' => $commissions->where('status', 'pending')->sum('amount'),
                    'approved' => $commissions->where('status', 'approved')->sum('amount'),
                    'paid' => $commissions->where('status', 'paid')->sum('amount'),
                    'cancelled' => $commissions->where('status', 'cancelled')->sum('amount'),
                    'count' => $commissions->count(),
                ],
                'recent_commissions' => Commission::where('affiliate_id', $affiliateId)
                    ->with(['order', 'referral'])
                    ->orderBy('created_at', 'desc')
                    ->limit(10)
                    ->get(),
                'performance' => [
                    'this_month_earnings' => $commissions
                        ->whereYear('created_at', now()->year)
                        ->whereMonth('created_at', now()->month)
                        ->where('status', 'approved')
                        ->sum('amount'),
                    'last_month_earnings' => $commissions
                        ->whereYear('created_at', now()->subMonth()->year)
                        ->whereMonth('created_at', now()->subMonth()->month)
                        ->where('status', 'approved')
                        ->sum('amount'),
                    'this_week_earnings' => $commissions
                        ->whereBetween('created_at', [now()->startOfWeek(), now()->endOfWeek()])
                        ->where('status', 'approved')
                        ->sum('amount'),
                ],
            ];
        });
    }

    /**
     * Get downline tree (MLM structure)
     */
    public function getDownlineTree(int $affiliateId, int $levels = 5): array
    {
        $affiliate = AffiliateAccount::with('user')->findOrFail($affiliateId);

        return [
            'id' => $affiliate->id,
            'user_id' => $affiliate->user_id,
            'name' => $affiliate->user->first_name . ' ' . $affiliate->user->last_name,
            'email' => $affiliate->user->email,
            'referral_code' => $affiliate->referral_code,
            'level' => 0,
            'total_earnings' => $affiliate->total_earnings,
            'total_referrals' => $affiliate->total_referrals,
            'active_referrals' => $affiliate->active_referrals,
            'status' => $affiliate->status,
            'children' => $levels > 0 ? $this->getDirectReferrals($affiliateId, $levels - 1) : [],
        ];
    }

    /**
     * Get direct referrals recursively
     */
    private function getDirectReferrals(int $affiliateId, int $remainingLevels): array
    {
        if ($remainingLevels < 0) {
            return [];
        }

        $referrals = AffiliateAccount::with('user')
            ->where('referrer_id', $affiliateId)
            ->get();

        return $referrals->map(function ($referral) use ($remainingLevels) {
            return [
                'id' => $referral->id,
                'user_id' => $referral->user_id,
                'name' => $referral->user->first_name . ' ' . $referral->user->last_name,
                'email' => $referral->user->email,
                'referral_code' => $referral->referral_code,
                'level' => 5 - $remainingLevels,
                'total_earnings' => $referral->total_earnings,
                'total_referrals' => $referral->total_referrals,
                'active_referrals' => $referral->active_referrals,
                'status' => $referral->status,
                'joined_at' => $referral->created_at->toDateTimeString(),
                'children' => $remainingLevels > 0 ? $this->getDirectReferrals($referral->id, $remainingLevels - 1) : [],
            ];
        })->toArray();
    }

    /**
     * Calculate commission for an order
     */
    public function calculateCommission(Order $order): void
    {
        // Get buyer's affiliate account (if they were referred)
        $buyer = $order->user;
        if (!$buyer || !$buyer->affiliateAccount || !$buyer->affiliateAccount->referrer_id) {
            return; // No referrer, no commission
        }

        $buyerAffiliate = $buyer->affiliateAccount;
        $commissionableAmount = $this->getCommissionableAmount($order);

        if ($commissionableAmount <= 0) {
            return;
        }

        DB::beginTransaction();

        try {
            // Multi-level commission structure
            $currentReferrer = $buyerAffiliate->referrer;
            $level = 1;
            $maxLevels = config('affiliate.max_commission_levels', 3);

            while ($currentReferrer && $level <= $maxLevels) {
                $commissionRate = $this->getCommissionRateForLevel($level, $currentReferrer);
                $commissionAmount = ($commissionableAmount * $commissionRate) / 100;

                if ($commissionAmount > 0) {
                    // Create commission record
                    Commission::create([
                        'affiliate_id' => $currentReferrer->id,
                        'order_id' => $order->id,
                        'referral_user_id' => $buyer->id,
                        'amount' => $commissionAmount,
                        'commission_rate' => $commissionRate,
                        'level' => $level,
                        'status' => 'pending',
                        'type' => 'order',
                        'order_amount' => $order->total_amount,
                    ]);

                    // Update affiliate pending balance
                    $currentReferrer->increment('pending_balance', $commissionAmount);
                }

                // Move to next level
                $currentReferrer = $currentReferrer->referrer;
                $level++;
            }

            DB::commit();

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Commission calculation failed: ' . $e->getMessage());
        }
    }

    /**
     * Get commissionable amount from order
     */
    private function getCommissionableAmount(Order $order): float
    {
        // Commission is calculated on subtotal (before tax and shipping)
        return $order->subtotal ?? $order->total_amount;
    }

    /**
     * Get commission rate for specific level
     */
    private function getCommissionRateForLevel(int $level, AffiliateAccount $affiliate): float
    {
        // Multi-level commission rates
        $rates = config('affiliate.level_rates', [
            1 => 10.0,  // Direct referral: 10%
            2 => 5.0,   // Level 2: 5%
            3 => 2.5,   // Level 3: 2.5%
        ]);

        // Use affiliate's custom rate for level 1, or default rates
        if ($level === 1 && $affiliate->commission_rate) {
            return $affiliate->commission_rate;
        }

        return $rates[$level] ?? 0;
    }

    /**
     * Approve commission (when order is delivered)
     */
    public function approveCommission(Commission $commission): bool
    {
        if ($commission->status !== 'pending') {
            return false;
        }

        DB::beginTransaction();

        try {
            $affiliate = $commission->affiliate;

            // Update commission status
            $commission->update([
                'status' => 'approved',
                'approved_at' => now(),
            ]);

            // Move from pending to available balance
            $affiliate->decrement('pending_balance', $commission->amount);
            $affiliate->increment('available_balance', $commission->amount);
            $affiliate->increment('total_earnings', $commission->amount);

            DB::commit();

            // Clear cache
            $this->clearAffiliateCache($affiliate->user_id);

            return true;

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Commission approval failed: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Cancel commission (when order is cancelled/refunded)
     */
    public function cancelCommission(Commission $commission): bool
    {
        if (!in_array($commission->status, ['pending', 'approved'])) {
            return false;
        }

        DB::beginTransaction();

        try {
            $affiliate = $commission->affiliate;
            $previousStatus = $commission->status;

            // Update commission status
            $commission->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
            ]);

            // Revert balance changes
            if ($previousStatus === 'pending') {
                $affiliate->decrement('pending_balance', $commission->amount);
            } elseif ($previousStatus === 'approved') {
                $affiliate->decrement('available_balance', $commission->amount);
                $affiliate->decrement('total_earnings', $commission->amount);
            }

            DB::commit();

            // Clear cache
            $this->clearAffiliateCache($affiliate->user_id);

            return true;

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Commission cancellation failed: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Get affiliate referrals with pagination
     */
    public function getReferrals(int $affiliateId, int $page = 1, int $perPage = 20): array
    {
        $referrals = AffiliateAccount::with(['user', 'commissions'])
            ->where('referrer_id', $affiliateId)
            ->orderBy('created_at', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);

        return [
            'data' => $referrals->items(),
            'pagination' => [
                'current_page' => $referrals->currentPage(),
                'per_page' => $referrals->perPage(),
                'total' => $referrals->total(),
                'last_page' => $referrals->lastPage(),
            ],
        ];
    }

    /**
     * Get commission history
     */
    public function getCommissionHistory(int $affiliateId, array $filters = []): array
    {
        $query = Commission::where('affiliate_id', $affiliateId)
            ->with(['order', 'referral']);

        // Apply filters
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (isset($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        if (isset($filters['from_date'])) {
            $query->whereDate('created_at', '>=', $filters['from_date']);
        }

        if (isset($filters['to_date'])) {
            $query->whereDate('created_at', '<=', $filters['to_date']);
        }

        $perPage = $filters['per_page'] ?? 20;
        $page = $filters['page'] ?? 1;

        $commissions = $query->orderBy('created_at', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);

        return [
            'data' => $commissions->items(),
            'pagination' => [
                'current_page' => $commissions->currentPage(),
                'per_page' => $commissions->perPage(),
                'total' => $commissions->total(),
                'last_page' => $commissions->lastPage(),
            ],
            'summary' => [
                'total_amount' => Commission::where('affiliate_id', $affiliateId)->sum('amount'),
                'pending_amount' => Commission::where('affiliate_id', $affiliateId)
                    ->where('status', 'pending')->sum('amount'),
                'approved_amount' => Commission::where('affiliate_id', $affiliateId)
                    ->where('status', 'approved')->sum('amount'),
            ],
        ];
    }

    /**
     * Get earnings chart data
     */
    public function getEarningsChart(int $affiliateId, int $days = 30): array
    {
        $startDate = now()->subDays($days)->startOfDay();
        $endDate = now()->endOfDay();

        $commissions = Commission::where('affiliate_id', $affiliateId)
            ->where('status', 'approved')
            ->whereBetween('approved_at', [$startDate, $endDate])
            ->selectRaw('DATE(approved_at) as date, SUM(amount) as total')
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->keyBy('date');

        $labels = [];
        $values = [];
        $currentDate = $startDate->copy();

        while ($currentDate <= $endDate) {
            $dateString = $currentDate->format('Y-m-d');
            $labels[] = $currentDate->format('M d');
            $values[] = $commissions->get($dateString)?->total ?? 0;
            $currentDate->addDay();
        }

        return [
            'labels' => $labels,
            'values' => $values,
            'total' => array_sum($values),
            'average' => count($values) > 0 ? array_sum($values) / count($values) : 0,
        ];
    }

    /**
     * Get referral performance
     */
    public function getReferralPerformance(int $affiliateId): array
    {
        $referrals = AffiliateAccount::where('referrer_id', $affiliateId)
            ->with(['user', 'commissions'])
            ->get();

        return $referrals->map(function ($referral) {
            $totalCommissions = $referral->commissions()
                ->where('status', 'approved')
                ->sum('amount');

            $orders = Order::where('user_id', $referral->user_id)
                ->where('status', 'delivered')
                ->count();

            return [
                'id' => $referral->id,
                'name' => $referral->user->first_name . ' ' . $referral->user->last_name,
                'email' => $referral->user->email,
                'joined_at' => $referral->created_at->toDateTimeString(),
                'total_orders' => $orders,
                'commissions_generated' => $totalCommissions,
                'status' => $referral->status,
            ];
        })->sortByDesc('commissions_generated')->values()->toArray();
    }

    /**
     * Update affiliate status
     */
    public function updateStatus(int $affiliateId, string $status): bool
    {
        $affiliate = AffiliateAccount::findOrFail($affiliateId);

        if (!in_array($status, ['active', 'inactive', 'suspended', 'banned'])) {
            throw new \Exception('Invalid status');
        }

        $affiliate->update(['status' => $status]);

        // Clear cache
        $this->clearAffiliateCache($affiliate->user_id);

        return true;
    }

    /**
     * Update commission rate
     */
    public function updateCommissionRate(int $affiliateId, float $rate): bool
    {
        if ($rate < 0 || $rate > 100) {
            throw new \Exception('Commission rate must be between 0 and 100');
        }

        $affiliate = AffiliateAccount::findOrFail($affiliateId);
        $affiliate->update(['commission_rate' => $rate]);

        // Clear cache
        $this->clearAffiliateCache($affiliate->user_id);

        return true;
    }

    /**
     * Get top affiliates
     */
    public function getTopAffiliates(int $limit = 10, string $period = 'all_time'): array
    {
        $query = AffiliateAccount::with('user');

        switch ($period) {
            case 'this_month':
                $query->whereHas('commissions', function ($q) {
                    $q->where('status', 'approved')
                        ->whereYear('approved_at', now()->year)
                        ->whereMonth('approved_at', now()->month);
                });
                break;
            case 'last_month':
                $query->whereHas('commissions', function ($q) {
                    $q->where('status', 'approved')
                        ->whereYear('approved_at', now()->subMonth()->year)
                        ->whereMonth('approved_at', now()->subMonth()->month);
                });
                break;
        }

        return $query->orderBy('total_earnings', 'desc')
            ->limit($limit)
            ->get()
            ->map(function ($affiliate) {
                return [
                    'id' => $affiliate->id,
                    'name' => $affiliate->user->first_name . ' ' . $affiliate->user->last_name,
                    'email' => $affiliate->user->email,
                    'total_earnings' => $affiliate->total_earnings,
                    'total_referrals' => $affiliate->total_referrals,
                    'active_referrals' => $affiliate->active_referrals,
                    'commission_rate' => $affiliate->commission_rate,
                ];
            })
            ->toArray();
    }

    /**
     * Clear affiliate cache
     */
    private function clearAffiliateCache(int $userId): void
    {
        $affiliate = AffiliateAccount::where('user_id', $userId)->first();
        if ($affiliate) {
            Cache::forget("affiliate:stats:{$affiliate->id}");
        }
    }

    /**
     * Get affiliate by referral code
     */
    public function getAffiliateByReferralCode(string $code): ?AffiliateAccount
    {
        return AffiliateAccount::where('referral_code', $code)
            ->where('status', 'active')
            ->first();
    }

    /**
     * Track referral click
     */
    public function trackReferralClick(string $referralCode, array $data = []): void
    {
        // This can be implemented with a separate tracking table
        // For now, we'll just log it
        \Log::info("Referral click tracked", [
            'referral_code' => $referralCode,
            'ip' => $data['ip'] ?? null,
            'user_agent' => $data['user_agent'] ?? null,
            'timestamp' => now(),
        ]);
    }
}
