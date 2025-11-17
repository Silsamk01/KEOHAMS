<?php

namespace App\Services;

use App\Models\AffiliateAccount;
use App\Models\Withdrawal;
use App\Models\PaymentTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class WithdrawalService
{
    /**
     * Request a withdrawal
     */
    public function requestWithdrawal(int $affiliateId, array $data): Withdrawal
    {
        $affiliate = AffiliateAccount::findOrFail($affiliateId);

        // Validate withdrawal amount
        $amount = $data['amount'];
        $minWithdrawal = config('affiliate.min_withdrawal', 1000);
        $maxWithdrawal = config('affiliate.max_withdrawal', 1000000);

        if ($amount < $minWithdrawal) {
            throw new \Exception("Minimum withdrawal amount is ₦{$minWithdrawal}");
        }

        if ($amount > $maxWithdrawal) {
            throw new \Exception("Maximum withdrawal amount is ₦{$maxWithdrawal}");
        }

        if ($amount > $affiliate->available_balance) {
            throw new \Exception('Insufficient balance');
        }

        // Check for pending withdrawals
        $pendingWithdrawals = Withdrawal::where('affiliate_id', $affiliateId)
            ->where('status', 'pending')
            ->sum('amount');

        if ($pendingWithdrawals + $amount > $affiliate->available_balance) {
            throw new \Exception('You have pending withdrawals. Cannot request more than available balance.');
        }

        DB::beginTransaction();

        try {
            // Create withdrawal request
            $withdrawal = Withdrawal::create([
                'affiliate_id' => $affiliateId,
                'amount' => $amount,
                'payment_method' => $data['payment_method'],
                'payment_details' => $data['payment_details'] ?? null,
                'bank_name' => $data['bank_name'] ?? null,
                'account_number' => $data['account_number'] ?? null,
                'account_name' => $data['account_name'] ?? null,
                'status' => 'pending',
                'request_date' => now(),
            ]);

            // Deduct from available balance (put on hold)
            $affiliate->decrement('available_balance', $amount);

            DB::commit();

            // Clear cache
            Cache::forget("affiliate:stats:{$affiliateId}");

            return $withdrawal;

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Approve withdrawal
     */
    public function approveWithdrawal(int $withdrawalId, int $adminId): bool
    {
        $withdrawal = Withdrawal::findOrFail($withdrawalId);

        if ($withdrawal->status !== 'pending') {
            throw new \Exception('Withdrawal is not pending');
        }

        DB::beginTransaction();

        try {
            // Update withdrawal status
            $withdrawal->update([
                'status' => 'approved',
                'approved_by' => $adminId,
                'approved_at' => now(),
            ]);

            DB::commit();

            return true;

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Process withdrawal (mark as paid)
     */
    public function processWithdrawal(int $withdrawalId, array $data): bool
    {
        $withdrawal = Withdrawal::with('affiliate')->findOrFail($withdrawalId);

        if ($withdrawal->status !== 'approved') {
            throw new \Exception('Withdrawal must be approved first');
        }

        DB::beginTransaction();

        try {
            $affiliate = $withdrawal->affiliate;

            // Update withdrawal status
            $withdrawal->update([
                'status' => 'completed',
                'processed_at' => now(),
                'transaction_reference' => $data['transaction_reference'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);

            // Update affiliate withdrawn amount
            $affiliate->increment('withdrawn_amount', $withdrawal->amount);

            // Create payment transaction record
            PaymentTransaction::create([
                'user_id' => $affiliate->user_id,
                'amount' => $withdrawal->amount,
                'type' => 'withdrawal',
                'status' => 'completed',
                'payment_method' => $withdrawal->payment_method,
                'reference' => $withdrawal->transaction_reference,
                'description' => 'Affiliate commission withdrawal',
                'metadata' => json_encode([
                    'withdrawal_id' => $withdrawal->id,
                    'affiliate_id' => $affiliate->id,
                ]),
            ]);

            DB::commit();

            // Clear cache
            Cache::forget("affiliate:stats:{$affiliate->id}");

            return true;

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Reject withdrawal
     */
    public function rejectWithdrawal(int $withdrawalId, int $adminId, string $reason): bool
    {
        $withdrawal = Withdrawal::with('affiliate')->findOrFail($withdrawalId);

        if ($withdrawal->status !== 'pending') {
            throw new \Exception('Can only reject pending withdrawals');
        }

        DB::beginTransaction();

        try {
            $affiliate = $withdrawal->affiliate;

            // Update withdrawal status
            $withdrawal->update([
                'status' => 'rejected',
                'rejected_by' => $adminId,
                'rejected_at' => now(),
                'rejection_reason' => $reason,
            ]);

            // Return amount to available balance
            $affiliate->increment('available_balance', $withdrawal->amount);

            DB::commit();

            // Clear cache
            Cache::forget("affiliate:stats:{$affiliate->id}");

            return true;

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Cancel withdrawal (by affiliate)
     */
    public function cancelWithdrawal(int $withdrawalId, int $affiliateId): bool
    {
        $withdrawal = Withdrawal::where('id', $withdrawalId)
            ->where('affiliate_id', $affiliateId)
            ->firstOrFail();

        if ($withdrawal->status !== 'pending') {
            throw new \Exception('Can only cancel pending withdrawals');
        }

        DB::beginTransaction();

        try {
            $affiliate = $withdrawal->affiliate;

            // Update withdrawal status
            $withdrawal->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
            ]);

            // Return amount to available balance
            $affiliate->increment('available_balance', $withdrawal->amount);

            DB::commit();

            // Clear cache
            Cache::forget("affiliate:stats:{$affiliateId}");

            return true;

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Get withdrawal history
     */
    public function getWithdrawalHistory(int $affiliateId, array $filters = []): array
    {
        $query = Withdrawal::where('affiliate_id', $affiliateId);

        // Apply filters
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (isset($filters['from_date'])) {
            $query->whereDate('request_date', '>=', $filters['from_date']);
        }

        if (isset($filters['to_date'])) {
            $query->whereDate('request_date', '<=', $filters['to_date']);
        }

        $perPage = $filters['per_page'] ?? 20;
        $page = $filters['page'] ?? 1;

        $withdrawals = $query->orderBy('request_date', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);

        return [
            'data' => $withdrawals->items(),
            'pagination' => [
                'current_page' => $withdrawals->currentPage(),
                'per_page' => $withdrawals->perPage(),
                'total' => $withdrawals->total(),
                'last_page' => $withdrawals->lastPage(),
            ],
            'summary' => [
                'total_requested' => Withdrawal::where('affiliate_id', $affiliateId)->sum('amount'),
                'total_completed' => Withdrawal::where('affiliate_id', $affiliateId)
                    ->where('status', 'completed')->sum('amount'),
                'total_pending' => Withdrawal::where('affiliate_id', $affiliateId)
                    ->where('status', 'pending')->sum('amount'),
            ],
        ];
    }

    /**
     * Get all withdrawals (admin)
     */
    public function getAllWithdrawals(array $filters = []): array
    {
        $query = Withdrawal::with(['affiliate.user']);

        // Apply filters
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (isset($filters['affiliate_id'])) {
            $query->where('affiliate_id', $filters['affiliate_id']);
        }

        if (isset($filters['from_date'])) {
            $query->whereDate('request_date', '>=', $filters['from_date']);
        }

        if (isset($filters['to_date'])) {
            $query->whereDate('request_date', '<=', $filters['to_date']);
        }

        $perPage = $filters['per_page'] ?? 20;
        $page = $filters['page'] ?? 1;

        $withdrawals = $query->orderBy('request_date', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);

        return [
            'data' => $withdrawals->items(),
            'pagination' => [
                'current_page' => $withdrawals->currentPage(),
                'per_page' => $withdrawals->perPage(),
                'total' => $withdrawals->total(),
                'last_page' => $withdrawals->lastPage(),
            ],
            'summary' => [
                'total_requested' => Withdrawal::sum('amount'),
                'total_completed' => Withdrawal::where('status', 'completed')->sum('amount'),
                'total_pending' => Withdrawal::where('status', 'pending')->sum('amount'),
                'total_rejected' => Withdrawal::where('status', 'rejected')->sum('amount'),
            ],
        ];
    }

    /**
     * Get withdrawal statistics
     */
    public function getWithdrawalStats(): array
    {
        return [
            'pending' => [
                'count' => Withdrawal::where('status', 'pending')->count(),
                'amount' => Withdrawal::where('status', 'pending')->sum('amount'),
            ],
            'approved' => [
                'count' => Withdrawal::where('status', 'approved')->count(),
                'amount' => Withdrawal::where('status', 'approved')->sum('amount'),
            ],
            'completed' => [
                'count' => Withdrawal::where('status', 'completed')->count(),
                'amount' => Withdrawal::where('status', 'completed')->sum('amount'),
            ],
            'rejected' => [
                'count' => Withdrawal::where('status', 'rejected')->count(),
                'amount' => Withdrawal::where('status', 'rejected')->sum('amount'),
            ],
            'today' => [
                'count' => Withdrawal::whereDate('request_date', today())->count(),
                'amount' => Withdrawal::whereDate('request_date', today())->sum('amount'),
            ],
            'this_month' => [
                'count' => Withdrawal::whereYear('request_date', now()->year)
                    ->whereMonth('request_date', now()->month)
                    ->count(),
                'amount' => Withdrawal::whereYear('request_date', now()->year)
                    ->whereMonth('request_date', now()->month)
                    ->sum('amount'),
            ],
        ];
    }

    /**
     * Validate payment details
     */
    public function validatePaymentDetails(string $method, array $details): bool
    {
        switch ($method) {
            case 'bank_transfer':
                $required = ['bank_name', 'account_number', 'account_name'];
                break;
            case 'paystack':
                $required = ['account_number', 'bank_name', 'account_name'];
                break;
            case 'wallet':
                $required = [];
                break;
            default:
                throw new \Exception('Invalid payment method');
        }

        foreach ($required as $field) {
            if (empty($details[$field])) {
                throw new \Exception("Missing required field: {$field}");
            }
        }

        return true;
    }

    /**
     * Get withdrawal limits
     */
    public function getWithdrawalLimits(int $affiliateId): array
    {
        $affiliate = AffiliateAccount::findOrFail($affiliateId);

        return [
            'min_withdrawal' => config('affiliate.min_withdrawal', 1000),
            'max_withdrawal' => config('affiliate.max_withdrawal', 1000000),
            'available_balance' => $affiliate->available_balance,
            'pending_withdrawals' => Withdrawal::where('affiliate_id', $affiliateId)
                ->where('status', 'pending')
                ->sum('amount'),
            'can_withdraw' => $affiliate->available_balance >= config('affiliate.min_withdrawal', 1000),
        ];
    }

    /**
     * Get recent withdrawals
     */
    public function getRecentWithdrawals(int $affiliateId, int $limit = 5): array
    {
        return Withdrawal::where('affiliate_id', $affiliateId)
            ->orderBy('request_date', 'desc')
            ->limit($limit)
            ->get()
            ->toArray();
    }
}
