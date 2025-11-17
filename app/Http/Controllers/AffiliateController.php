<?php

namespace App\Http\Controllers;

use App\Models\AffiliateAccount;
use App\Models\AffiliateSale;
use App\Models\AffiliateWithdrawal;
use App\Models\AffiliateClick;
use App\Models\AffiliateConversion;
use App\Models\ActivityLog;
use App\Models\Commission;
use App\Models\Withdrawal;
use App\Mail\AffiliateWelcomeEmail;
use App\Services\AffiliateService;
use App\Services\WithdrawalService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AffiliateController extends Controller
{
    private AffiliateService $affiliateService;
    private WithdrawalService $withdrawalService;

    public function __construct(
        AffiliateService $affiliateService,
        WithdrawalService $withdrawalService
    ) {
        $this->affiliateService = $affiliateService;
        $this->withdrawalService = $withdrawalService;
    }
    /**
     * Register new affiliate
     */
    public function register(Request $request)
    {
        $validated = $request->validate([
            'first_name' => 'required|string|max:100',
            'last_name' => 'required|string|max:100',
            'email' => 'required|email|unique:affiliate_accounts,email',
            'password' => 'required|string|min:8|confirmed',
            'phone' => 'required|string|max:20',
            'referral_code' => 'nullable|string|exists:affiliate_accounts,referral_code',
            'payment_method' => 'required|in:BANK_TRANSFER,PAYPAL,MOBILE_MONEY',
            'payment_details' => 'required|array',
        ]);

        $affiliate = AffiliateAccount::create([
            'first_name' => $validated['first_name'],
            'last_name' => $validated['last_name'],
            'email' => $validated['email'],
            'password' => $validated['password'], // Auto-hashed
            'phone' => $validated['phone'],
            'referral_code' => Str::upper(Str::random(10)),
            'status' => 'PENDING',
            'payment_method' => $validated['payment_method'],
            'payment_details' => $validated['payment_details'],
        ]);

        // Set parent if referral code provided
        if (!empty($validated['referral_code'])) {
            $parent = AffiliateAccount::where('referral_code', $validated['referral_code'])
                ->where('status', 'ACTIVE')
                ->first();
            
            if ($parent) {
                $affiliate->parent_id = $parent->id;
                $affiliate->save();
            }
        }

        ActivityLog::log('AFFILIATE_REGISTERED', null, 'Affiliate registered', [
            'affiliate_id' => $affiliate->id,
            'email' => $affiliate->email,
        ]);

        // Send welcome email
        Mail::to($affiliate->email)->queue(new AffiliateWelcomeEmail($affiliate));

        return response()->json([
            'message' => 'Affiliate registration successful. Your account is pending approval.',
            'affiliate' => [
                'id' => $affiliate->id,
                'first_name' => $affiliate->first_name,
                'last_name' => $affiliate->last_name,
                'email' => $affiliate->email,
                'referral_code' => $affiliate->referral_code,
                'status' => $affiliate->status,
            ]
        ], 201);
    }

    /**
     * Affiliate login
     */
    public function login(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $affiliate = AffiliateAccount::where('email', $validated['email'])->first();

        if (!$affiliate || !Hash::check($validated['password'], $affiliate->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if ($affiliate->status !== 'ACTIVE') {
            return response()->json([
                'message' => 'Your affiliate account is ' . strtolower($affiliate->status) . '.',
            ], 403);
        }

        $token = $affiliate->createToken('affiliate-token', ['*'], now()->addDays(30))->plainTextToken;

        ActivityLog::log('AFFILIATE_LOGIN', null, 'Affiliate logged in', [
            'affiliate_id' => $affiliate->id,
        ]);

        return response()->json([
            'message' => 'Login successful.',
            'token' => $token,
            'affiliate' => [
                'id' => $affiliate->id,
                'first_name' => $affiliate->first_name,
                'last_name' => $affiliate->last_name,
                'email' => $affiliate->email,
                'referral_code' => $affiliate->referral_code,
                'status' => $affiliate->status,
            ]
        ]);
    }

    /**
     * Get affiliate dashboard stats
     */
    public function dashboard(Request $request)
    {
        $affiliate = $request->user();

        $stats = [
            'total_earnings' => $affiliate->total_earnings,
            'available_balance' => $affiliate->available_balance,
            'pending_balance' => $affiliate->pending_balance,
            'total_clicks' => $affiliate->total_clicks,
            'total_conversions' => $affiliate->total_conversions,
            'conversion_rate' => $affiliate->conversion_rate,
            'referral_code' => $affiliate->referral_code,
            'referral_link' => config('app.url') . '/register?ref=' . $affiliate->referral_code,
            'direct_referrals' => $affiliate->children()->count(),
        ];

        // Recent sales
        $recentSales = $affiliate->sales()
            ->with('customer')
            ->latest()
            ->limit(10)
            ->get();

        // Recent commissions
        $recentCommissions = $affiliate->commissions()
            ->with('sale')
            ->latest()
            ->limit(10)
            ->get();

        return response()->json([
            'stats' => $stats,
            'recent_sales' => $recentSales,
            'recent_commissions' => $recentCommissions,
        ]);
    }

    /**
     * Get affiliate sales
     */
    public function sales(Request $request)
    {
        $affiliate = $request->user();

        $query = $affiliate->sales()->with('customer');

        // Filter by verification status
        if ($request->has('status')) {
            $query->where('verification_status', $request->status);
        }

        $sales = $query->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($sales);
    }

    /**
     * Get affiliate commissions
     */
    public function commissions(Request $request)
    {
        $affiliate = $request->user();

        $query = $affiliate->commissions()->with('sale');

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $commissions = $query->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($commissions);
    }

    /**
     * Request withdrawal
     */
    public function requestWithdrawal(Request $request)
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:1000', // Minimum withdrawal amount
        ]);

        $affiliate = $request->user();

        if ($validated['amount'] > $affiliate->available_balance) {
            return response()->json([
                'message' => 'Insufficient balance.'
            ], 400);
        }

        $withdrawal = AffiliateWithdrawal::create([
            'affiliate_account_id' => $affiliate->id,
            'amount' => $validated['amount'],
            'method' => $affiliate->payment_method,
            'payment_details' => $affiliate->payment_details,
            'status' => 'PENDING',
        ]);

        // Deduct from available balance
        $affiliate->deductBalance($validated['amount']);

        ActivityLog::log('AFFILIATE_WITHDRAWAL_REQUESTED', null, 'Affiliate withdrawal requested', [
            'affiliate_id' => $affiliate->id,
            'withdrawal_id' => $withdrawal->id,
            'amount' => $validated['amount'],
        ]);

        return response()->json([
            'message' => 'Withdrawal request submitted successfully.',
            'withdrawal' => $withdrawal
        ], 201);
    }

    /**
     * Get withdrawal history
     */
    public function withdrawals(Request $request)
    {
        $affiliate = $request->user();

        $withdrawals = $affiliate->withdrawals()
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($withdrawals);
    }

    /**
     * Get downline (referrals)
     */
    public function downline(Request $request)
    {
        $affiliate = $request->user();

        $downline = $affiliate->children()
            ->withCount('sales')
            ->get();

        return response()->json($downline);
    }

    /**
     * Track affiliate click
     */
    public function trackClick(Request $request)
    {
        $validated = $request->validate([
            'referral_code' => 'required|string|exists:affiliate_accounts,referral_code',
            'source' => 'nullable|string',
            'campaign' => 'nullable|string',
        ]);

        $affiliate = AffiliateAccount::where('referral_code', $validated['referral_code'])
            ->where('status', 'ACTIVE')
            ->first();

        if (!$affiliate) {
            return response()->json(['message' => 'Invalid referral code.'], 404);
        }

        AffiliateClick::create([
            'affiliate_account_id' => $affiliate->id,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'referrer' => $request->header('referer'),
            'source' => $validated['source'] ?? null,
            'campaign' => $validated['campaign'] ?? null,
        ]);

        $affiliate->increment('total_clicks');

        return response()->json(['message' => 'Click tracked.']);
    }

    /**
     * Admin: Get all affiliates
     */
    public function adminIndex(Request $request)
    {
        $query = AffiliateAccount::withCount(['sales', 'children']);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('first_name', 'LIKE', "%{$search}%")
                  ->orWhere('last_name', 'LIKE', "%{$search}%")
                  ->orWhere('email', 'LIKE', "%{$search}%")
                  ->orWhere('referral_code', 'LIKE', "%{$search}%");
            });
        }

        $affiliates = $query->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($affiliates);
    }

    /**
     * Admin: Approve affiliate
     */
    public function approve(Request $request, $id)
    {
        $affiliate = AffiliateAccount::findOrFail($id);

        $affiliate->approve();

        // Send approval email
        Mail::to($affiliate->email)->send(new AffiliateApprovedEmail($affiliate));

        ActivityLog::log('AFFILIATE_APPROVED', $request->user()->id, 'Affiliate approved', [
            'affiliate_id' => $affiliate->id,
        ]);

        return response()->json([
            'message' => 'Affiliate approved successfully.',
            'affiliate' => $affiliate
        ]);
    }

    /**
     * Admin: Suspend affiliate
     */
    public function suspend(Request $request, $id)
    {
        $validated = $request->validate([
            'reason' => 'nullable|string',
        ]);

        $affiliate = AffiliateAccount::findOrFail($id);

        $affiliate->suspend($validated['reason'] ?? null);

        ActivityLog::log('AFFILIATE_SUSPENDED', $request->user()->id, 'Affiliate suspended', [
            'affiliate_id' => $affiliate->id,
            'reason' => $validated['reason'] ?? null,
        ]);

        return response()->json([
            'message' => 'Affiliate suspended successfully.',
            'affiliate' => $affiliate
        ]);
    }

    /**
     * Admin: Process withdrawal
     */
    public function processWithdrawal(Request $request, $id)
    {
        $validated = $request->validate([
            'status' => 'required|in:APPROVED,REJECTED',
            'transaction_reference' => 'required_if:status,APPROVED|string',
            'admin_notes' => 'nullable|string',
        ]);

        $withdrawal = AffiliateWithdrawal::findOrFail($id);

        if ($withdrawal->status !== 'PENDING') {
            return response()->json(['message' => 'Withdrawal already processed.'], 400);
        }

        $withdrawal->update([
            'status' => $validated['status'],
            'transaction_reference' => $validated['transaction_reference'] ?? null,
            'admin_notes' => $validated['admin_notes'] ?? null,
            'processed_by' => $request->user()->id,
            'processed_at' => now(),
        ]);

        // If rejected, return balance to affiliate
        if ($validated['status'] === 'REJECTED') {
            $affiliate = $withdrawal->affiliateAccount;
            $affiliate->addEarnings($withdrawal->amount, 'REFUND');
        }

        ActivityLog::log('AFFILIATE_WITHDRAWAL_PROCESSED', $request->user()->id, 'Affiliate withdrawal processed', [
            'withdrawal_id' => $withdrawal->id,
            'status' => $validated['status'],
            'amount' => $withdrawal->amount,
        ]);

        return response()->json([
            'message' => 'Withdrawal processed successfully.',
            'withdrawal' => $withdrawal
        ]);
    }

    /**
     * Get enhanced affiliate statistics
     */
    public function getStats(Request $request)
    {
        try {
            $affiliate = $request->user()->affiliateAccount;
            
            if (!$affiliate) {
                return response()->json([
                    'success' => false,
                    'message' => 'Affiliate account not found'
                ], 404);
            }

            $stats = $this->affiliateService->getAffiliateStats($affiliate->id);

            return response()->json([
                'success' => true,
                'data' => $stats
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch statistics',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get downline tree (MLM structure)
     */
    public function getDownlineTree(Request $request)
    {
        try {
            $affiliate = $request->user()->affiliateAccount;
            
            if (!$affiliate) {
                return response()->json([
                    'success' => false,
                    'message' => 'Affiliate account not found'
                ], 404);
            }

            $levels = $request->input('levels', 5);
            $tree = $this->affiliateService->getDownlineTree($affiliate->id, $levels);

            return response()->json([
                'success' => true,
                'data' => $tree
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch downline tree',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get referrals list
     */
    public function getReferrals(Request $request)
    {
        try {
            $affiliate = $request->user()->affiliateAccount;
            
            if (!$affiliate) {
                return response()->json([
                    'success' => false,
                    'message' => 'Affiliate account not found'
                ], 404);
            }

            $page = $request->input('page', 1);
            $perPage = $request->input('per_page', 20);
            
            $referrals = $this->affiliateService->getReferrals($affiliate->id, $page, $perPage);

            return response()->json([
                'success' => true,
                'data' => $referrals['data'],
                'pagination' => $referrals['pagination']
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch referrals',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get commission history
     */
    public function getCommissionHistory(Request $request)
    {
        try {
            $affiliate = $request->user()->affiliateAccount;
            
            if (!$affiliate) {
                return response()->json([
                    'success' => false,
                    'message' => 'Affiliate account not found'
                ], 404);
            }

            $filters = [
                'status' => $request->input('status'),
                'type' => $request->input('type'),
                'from_date' => $request->input('from_date'),
                'to_date' => $request->input('to_date'),
                'page' => $request->input('page', 1),
                'per_page' => $request->input('per_page', 20),
            ];
            
            $history = $this->affiliateService->getCommissionHistory($affiliate->id, $filters);

            return response()->json([
                'success' => true,
                'data' => $history['data'],
                'pagination' => $history['pagination'],
                'summary' => $history['summary']
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch commission history',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get earnings chart
     */
    public function getEarningsChart(Request $request)
    {
        try {
            $affiliate = $request->user()->affiliateAccount;
            
            if (!$affiliate) {
                return response()->json([
                    'success' => false,
                    'message' => 'Affiliate account not found'
                ], 404);
            }

            $days = $request->input('days', 30);
            $chart = $this->affiliateService->getEarningsChart($affiliate->id, $days);

            return response()->json([
                'success' => true,
                'data' => $chart
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch earnings chart',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get referral performance
     */
    public function getReferralPerformance(Request $request)
    {
        try {
            $affiliate = $request->user()->affiliateAccount;
            
            if (!$affiliate) {
                return response()->json([
                    'success' => false,
                    'message' => 'Affiliate account not found'
                ], 404);
            }

            $performance = $this->affiliateService->getReferralPerformance($affiliate->id);

            return response()->json([
                'success' => true,
                'data' => $performance
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch referral performance',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Request new withdrawal
     */
    public function requestNewWithdrawal(Request $request)
    {
        try {
            $validated = $request->validate([
                'amount' => 'required|numeric|min:1000',
                'payment_method' => 'required|in:bank_transfer,paystack,wallet',
                'bank_name' => 'required_if:payment_method,bank_transfer,paystack|string',
                'account_number' => 'required_if:payment_method,bank_transfer,paystack|string',
                'account_name' => 'required_if:payment_method,bank_transfer,paystack|string',
            ]);

            $affiliate = $request->user()->affiliateAccount;
            
            if (!$affiliate) {
                return response()->json([
                    'success' => false,
                    'message' => 'Affiliate account not found'
                ], 404);
            }

            $data = [
                'amount' => $validated['amount'],
                'payment_method' => $validated['payment_method'],
                'payment_details' => [],
            ];

            if ($validated['payment_method'] !== 'wallet') {
                $data['bank_name'] = $validated['bank_name'];
                $data['account_number'] = $validated['account_number'];
                $data['account_name'] = $validated['account_name'];
            }

            $withdrawal = $this->withdrawalService->requestWithdrawal($affiliate->id, $data);

            return response()->json([
                'success' => true,
                'message' => 'Withdrawal request submitted successfully',
                'data' => $withdrawal
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Get withdrawal history (enhanced)
     */
    public function getWithdrawalHistory(Request $request)
    {
        try {
            $affiliate = $request->user()->affiliateAccount;
            
            if (!$affiliate) {
                return response()->json([
                    'success' => false,
                    'message' => 'Affiliate account not found'
                ], 404);
            }

            $filters = [
                'status' => $request->input('status'),
                'from_date' => $request->input('from_date'),
                'to_date' => $request->input('to_date'),
                'page' => $request->input('page', 1),
                'per_page' => $request->input('per_page', 20),
            ];
            
            $history = $this->withdrawalService->getWithdrawalHistory($affiliate->id, $filters);

            return response()->json([
                'success' => true,
                'data' => $history['data'],
                'pagination' => $history['pagination'],
                'summary' => $history['summary']
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch withdrawal history',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Cancel withdrawal
     */
    public function cancelWithdrawal(Request $request, $id)
    {
        try {
            $affiliate = $request->user()->affiliateAccount;
            
            if (!$affiliate) {
                return response()->json([
                    'success' => false,
                    'message' => 'Affiliate account not found'
                ], 404);
            }

            $this->withdrawalService->cancelWithdrawal($id, $affiliate->id);

            return response()->json([
                'success' => true,
                'message' => 'Withdrawal cancelled successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Get withdrawal limits
     */
    public function getWithdrawalLimits(Request $request)
    {
        try {
            $affiliate = $request->user()->affiliateAccount;
            
            if (!$affiliate) {
                return response()->json([
                    'success' => false,
                    'message' => 'Affiliate account not found'
                ], 404);
            }

            $limits = $this->withdrawalService->getWithdrawalLimits($affiliate->id);

            return response()->json([
                'success' => true,
                'data' => $limits
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch withdrawal limits',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Admin: Get all withdrawals
     */
    public function adminGetWithdrawals(Request $request)
    {
        try {
            $filters = [
                'status' => $request->input('status'),
                'affiliate_id' => $request->input('affiliate_id'),
                'from_date' => $request->input('from_date'),
                'to_date' => $request->input('to_date'),
                'page' => $request->input('page', 1),
                'per_page' => $request->input('per_page', 20),
            ];
            
            $withdrawals = $this->withdrawalService->getAllWithdrawals($filters);

            return response()->json([
                'success' => true,
                'data' => $withdrawals['data'],
                'pagination' => $withdrawals['pagination'],
                'summary' => $withdrawals['summary']
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch withdrawals',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Admin: Approve withdrawal
     */
    public function adminApproveWithdrawal(Request $request, $id)
    {
        try {
            $adminId = $request->user()->id;
            $this->withdrawalService->approveWithdrawal($id, $adminId);

            return response()->json([
                'success' => true,
                'message' => 'Withdrawal approved successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Admin: Process withdrawal (mark as paid)
     */
    public function adminProcessWithdrawalNew(Request $request, $id)
    {
        try {
            $validated = $request->validate([
                'transaction_reference' => 'required|string',
                'notes' => 'nullable|string',
            ]);

            $this->withdrawalService->processWithdrawal($id, $validated);

            return response()->json([
                'success' => true,
                'message' => 'Withdrawal processed successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Admin: Reject withdrawal
     */
    public function adminRejectWithdrawal(Request $request, $id)
    {
        try {
            $validated = $request->validate([
                'reason' => 'required|string',
            ]);

            $adminId = $request->user()->id;
            $this->withdrawalService->rejectWithdrawal($id, $adminId, $validated['reason']);

            return response()->json([
                'success' => true,
                'message' => 'Withdrawal rejected successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Admin: Get top affiliates
     */
    public function adminGetTopAffiliates(Request $request)
    {
        try {
            $limit = $request->input('limit', 10);
            $period = $request->input('period', 'all_time');
            
            $topAffiliates = $this->affiliateService->getTopAffiliates($limit, $period);

            return response()->json([
                'success' => true,
                'data' => $topAffiliates
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch top affiliates',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Admin: Update affiliate status
     */
    public function adminUpdateStatus(Request $request, $id)
    {
        try {
            $validated = $request->validate([
                'status' => 'required|in:active,inactive,suspended,banned',
            ]);

            $this->affiliateService->updateStatus($id, $validated['status']);

            return response()->json([
                'success' => true,
                'message' => 'Affiliate status updated successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Admin: Update commission rate
     */
    public function adminUpdateCommissionRate(Request $request, $id)
    {
        try {
            $validated = $request->validate([
                'commission_rate' => 'required|numeric|min:0|max:100',
            ]);

            $this->affiliateService->updateCommissionRate($id, $validated['commission_rate']);

            return response()->json([
                'success' => true,
                'message' => 'Commission rate updated successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Admin: Get withdrawal statistics
     */
    public function adminGetWithdrawalStats(Request $request)
    {
        try {
            $stats = $this->withdrawalService->getWithdrawalStats();

            return response()->json([
                'success' => true,
                'data' => $stats
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch withdrawal statistics',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
