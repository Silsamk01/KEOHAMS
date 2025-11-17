<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Order;
use App\Models\Product;
use App\Models\KYCSubmission;
use App\Models\Quotation;
use App\Models\PaymentTransaction;
use App\Models\AffiliateAccount;
use App\Models\ActivityLog;
use App\Models\PlatformSetting;
use App\Services\AnalyticsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class AdminController extends Controller
{
    private AnalyticsService $analyticsService;

    public function __construct(AnalyticsService $analyticsService)
    {
        $this->analyticsService = $analyticsService;
    }
    /**
     * Get dashboard statistics
     */
    public function dashboard()
    {
        $stats = [
            'users' => [
                'total' => User::count(),
                'new_today' => User::whereDate('created_at', today())->count(),
                'verified' => User::where('email_verified', true)->count(),
                'kyc_verified' => User::whereHas('verificationState', function($q) {
                    $q->where('verification_tier', 'KYC_VERIFIED');
                })->count(),
            ],
            'orders' => [
                'total' => Order::count(),
                'pending' => Order::where('status', 'PENDING')->count(),
                'today' => Order::whereDate('created_at', today())->count(),
                'revenue_today' => Order::whereDate('created_at', today())
                    ->where('payment_status', 'PAID')
                    ->sum('total_amount'),
                'revenue_month' => Order::whereMonth('created_at', now()->month)
                    ->whereYear('created_at', now()->year)
                    ->where('payment_status', 'PAID')
                    ->sum('total_amount'),
            ],
            'products' => [
                'total' => Product::count(),
                'active' => Product::where('status', 'ACTIVE')->count(),
                'out_of_stock' => Product::where('stock_quantity', 0)->count(),
                'low_stock' => Product::whereColumn('stock_quantity', '<=', 'reorder_level')->count(),
            ],
            'kyc' => [
                'pending' => KYCSubmission::whereIn('status', ['PENDING', 'UNDER_REVIEW'])->count(),
                'approved_today' => KYCSubmission::where('status', 'APPROVED')
                    ->whereDate('reviewed_at', today())
                    ->count(),
            ],
            'quotations' => [
                'pending' => Quotation::where('status', 'REQUESTED')->count(),
                'replied_today' => Quotation::where('status', 'REPLIED')
                    ->whereDate('replied_at', today())
                    ->count(),
            ],
            'affiliates' => [
                'total' => AffiliateAccount::count(),
                'pending' => AffiliateAccount::where('status', 'PENDING')->count(),
                'active' => AffiliateAccount::where('status', 'ACTIVE')->count(),
            ],
        ];

        return response()->json($stats);
    }

    /**
     * Get recent activity logs
     */
    public function activityLogs(Request $request)
    {
        $query = ActivityLog::with('user')->orderBy('created_at', 'desc');

        // Filter by action
        if ($request->has('action')) {
            $query->where('action', $request->action);
        }

        // Filter by user
        if ($request->has('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        // Date range
        if ($request->has('from_date')) {
            $query->whereDate('created_at', '>=', $request->from_date);
        }
        if ($request->has('to_date')) {
            $query->whereDate('created_at', '<=', $request->to_date);
        }

        $logs = $query->paginate(50);

        return response()->json($logs);
    }

    /**
     * Get all users
     */
    public function users(Request $request)
    {
        $query = User::with('verificationState');

        // Filter by role
        if ($request->has('role')) {
            $query->where('role', $request->role);
        }

        // Filter by verification status
        if ($request->has('email_verified')) {
            $query->where('email_verified', $request->email_verified === 'true');
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('first_name', 'LIKE', "%{$search}%")
                  ->orWhere('last_name', 'LIKE', "%{$search}%")
                  ->orWhere('email', 'LIKE', "%{$search}%")
                  ->orWhere('phone', 'LIKE', "%{$search}%");
            });
        }

        $users = $query->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($users);
    }

    /**
     * Get single user details
     */
    public function userDetails($id)
    {
        $user = User::with([
            'verificationState',
            'kycSubmissions',
            'orders',
            'quotations',
            'paymentTransactions',
            'activityLogs' => function($query) {
                $query->latest()->limit(20);
            }
        ])->findOrFail($id);

        return response()->json($user);
    }

    /**
     * Update user
     */
    public function updateUser(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'first_name' => 'sometimes|string|max:100',
            'last_name' => 'sometimes|string|max:100',
            'email' => 'sometimes|email|unique:users,email,' . $id,
            'phone' => 'sometimes|string|max:20',
            'role' => 'sometimes|in:CUSTOMER,ADMIN,MANAGER,SUPPORT',
            'email_verified' => 'sometimes|boolean',
        ]);

        $user->update($validated);

        ActivityLog::log('USER_UPDATED_BY_ADMIN', $request->user()->id, 'User updated by admin', [
            'target_user_id' => $user->id,
        ]);

        return response()->json([
            'message' => 'User updated successfully.',
            'user' => $user
        ]);
    }

    /**
     * Delete user
     */
    public function deleteUser(Request $request, $id)
    {
        $user = User::findOrFail($id);

        // Prevent deleting self
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Cannot delete your own account.'], 400);
        }

        ActivityLog::log('USER_DELETED_BY_ADMIN', $request->user()->id, 'User deleted by admin', [
            'deleted_user_id' => $user->id,
            'deleted_user_email' => $user->email,
        ]);

        $user->delete();

        return response()->json(['message' => 'User deleted successfully.']);
    }

    /**
     * Reset user password
     */
    public function resetUserPassword(Request $request, $id)
    {
        $validated = $request->validate([
            'new_password' => 'required|string|min:8',
        ]);

        $user = User::findOrFail($id);

        $user->password = $validated['new_password'];
        $user->incrementTokenVersion();
        $user->save();

        ActivityLog::log('USER_PASSWORD_RESET_BY_ADMIN', $request->user()->id, 'User password reset by admin', [
            'target_user_id' => $user->id,
        ]);

        return response()->json(['message' => 'User password reset successfully.']);
    }

    /**
     * Get platform settings
     */
    public function settings()
    {
        $settings = PlatformSetting::all()->mapWithKeys(function($setting) {
            return [$setting->setting_key => $setting->getValue()];
        });

        return response()->json($settings);
    }

    /**
     * Update platform setting
     */
    public function updateSetting(Request $request)
    {
        $validated = $request->validate([
            'key' => 'required|string',
            'value' => 'required',
            'type' => 'required|in:STRING,NUMBER,BOOLEAN,JSON',
        ]);

        $value = $validated['value'];
        if ($validated['type'] === 'JSON' && is_array($value)) {
            $value = json_encode($value);
        }

        $setting = PlatformSetting::updateOrCreate(
            ['setting_key' => $validated['key']],
            [
                'setting_value' => $value,
                'value_type' => $validated['type'],
            ]
        );

        ActivityLog::log('PLATFORM_SETTING_UPDATED', $request->user()->id, 'Platform setting updated', [
            'key' => $validated['key'],
        ]);

        return response()->json([
            'message' => 'Setting updated successfully.',
            'setting' => $setting
        ]);
    }

    /**
     * Get revenue analytics
     */
    public function revenueAnalytics(Request $request)
    {
        $period = $request->input('period', 'month'); // day, week, month, year

        $query = PaymentTransaction::where('status', 'SUCCESS');

        switch ($period) {
            case 'day':
                $query->whereDate('created_at', today());
                break;
            case 'week':
                $query->whereBetween('created_at', [now()->startOfWeek(), now()->endOfWeek()]);
                break;
            case 'month':
                $query->whereMonth('created_at', now()->month)
                      ->whereYear('created_at', now()->year);
                break;
            case 'year':
                $query->whereYear('created_at', now()->year);
                break;
        }

        $data = [
            'total_revenue' => $query->sum('amount'),
            'transaction_count' => $query->count(),
            'average_transaction' => $query->avg('amount'),
            'by_day' => $query->select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('SUM(amount) as revenue'),
                DB::raw('COUNT(*) as count')
            )
            ->groupBy('date')
            ->orderBy('date')
            ->get(),
        ];

        return response()->json($data);
    }

    /**
     * Get top products
     */
    public function topProducts(Request $request)
    {
        $limit = $request->input('limit', 10);

        $products = Product::withCount(['orderItems as total_orders' => function($query) {
            $query->select(DB::raw('SUM(quantity)'));
        }])
        ->orderBy('total_orders', 'desc')
        ->limit($limit)
        ->get();

        return response()->json($products);
    }

    /**
     * Get top customers
     */
    public function topCustomers(Request $request)
    {
        $limit = $request->input('limit', 10);

        $customers = User::withCount('orders')
            ->withSum(['orders as total_spent' => function($query) {
                $query->where('payment_status', 'PAID');
            }], 'total_amount')
            ->orderBy('total_spent', 'desc')
            ->limit($limit)
            ->get();

        return response()->json($customers);
    }

    /**
     * Export data
     */
    public function exportData(Request $request)
    {
        $validated = $request->validate([
            'type' => 'required|in:users,orders,products,transactions',
            'format' => 'required|in:csv,json',
        ]);

        // TODO: Implement data export functionality
        
        return response()->json([
            'message' => 'Export functionality coming soon.',
        ]);
    }

    /**
     * System health check
     */
    public function healthCheck()
    {
        $health = [
            'database' => 'OK',
            'redis' => 'OK',
            'storage' => 'OK',
        ];

        try {
            DB::connection()->getPdo();
        } catch (\Exception $e) {
            $health['database'] = 'ERROR';
        }

        try {
            \Illuminate\Support\Facades\Redis::connection()->ping();
        } catch (\Exception $e) {
            $health['redis'] = 'ERROR';
        }

        try {
            \Illuminate\Support\Facades\Storage::disk('local')->exists('test');
        } catch (\Exception $e) {
            $health['storage'] = 'ERROR';
        }

        return response()->json($health);
    }

    /**
     * Get comprehensive dashboard statistics
     * GET /api/v1/admin/dashboard/stats
     */
    public function getDashboardStats()
    {
        $stats = $this->analyticsService->getDashboardStats();

        return response()->json([
            'success' => true,
            'data' => $stats,
        ]);
    }

    /**
     * Get revenue chart data
     * GET /api/v1/admin/analytics/revenue-chart
     */
    public function getRevenueChart(Request $request)
    {
        $days = $request->input('days', 30);
        $data = $this->analyticsService->getRevenueChartData($days);

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * Get orders chart data
     * GET /api/v1/admin/analytics/orders-chart
     */
    public function getOrdersChart(Request $request)
    {
        $days = $request->input('days', 30);
        $data = $this->analyticsService->getOrdersChartData($days);

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * Get top products
     * GET /api/v1/admin/analytics/top-products
     */
    public function getTopProducts(Request $request)
    {
        $limit = $request->input('limit', 10);
        $products = $this->analyticsService->getTopProducts($limit);

        return response()->json([
            'success' => true,
            'data' => $products,
        ]);
    }

    /**
     * Get top customers
     * GET /api/v1/admin/analytics/top-customers
     */
    public function getTopCustomers(Request $request)
    {
        $limit = $request->input('limit', 10);
        $customers = $this->analyticsService->getTopCustomers($limit);

        return response()->json([
            'success' => true,
            'data' => $customers,
        ]);
    }

    /**
     * Get sales by category
     * GET /api/v1/admin/analytics/sales-by-category
     */
    public function getSalesByCategory()
    {
        $data = $this->analyticsService->getSalesByCategory();

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * Get user growth data
     * GET /api/v1/admin/analytics/user-growth
     */
    public function getUserGrowth()
    {
        $data = $this->analyticsService->getUserGrowthData();

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * Get payment method distribution
     * GET /api/v1/admin/analytics/payment-methods
     */
    public function getPaymentMethodDistribution()
    {
        $data = $this->analyticsService->getPaymentMethodDistribution();

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * Get system health metrics
     * GET /api/v1/admin/system/health
     */
    public function getSystemHealth()
    {
        $health = $this->analyticsService->getSystemHealth();

        return response()->json([
            'success' => true,
            'data' => $health,
        ]);
    }

    /**
     * Clear analytics cache
     * POST /api/v1/admin/analytics/clear-cache
     */
    public function clearAnalyticsCache()
    {
        $this->analyticsService->clearCache();

        return response()->json([
            'success' => true,
            'message' => 'Analytics cache cleared successfully',
        ]);
    }
}

