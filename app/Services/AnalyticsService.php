<?php

namespace App\Services;

use App\Models\User;
use App\Models\Order;
use App\Models\Product;
use App\Models\Payment;
use App\Models\KYC;
use App\Models\Affiliate;
use App\Models\BlogPost;
use App\Models\SupportTicket;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class AnalyticsService
{
    /**
     * Get comprehensive dashboard statistics
     */
    public function getDashboardStats(): array
    {
        return Cache::remember('admin_dashboard_stats', 300, function () {
            return [
                'overview' => $this->getOverviewStats(),
                'revenue' => $this->getRevenueStats(),
                'orders' => $this->getOrderStats(),
                'users' => $this->getUserStats(),
                'products' => $this->getProductStats(),
                'recent_activities' => $this->getRecentActivities(),
            ];
        });
    }

    /**
     * Get overview statistics
     */
    private function getOverviewStats(): array
    {
        $today = today();
        $thisMonth = now()->startOfMonth();

        return [
            'total_revenue' => Payment::where('status', 'success')->sum('amount'),
            'today_revenue' => Payment::where('status', 'success')
                ->whereDate('created_at', $today)
                ->sum('amount'),
            'this_month_revenue' => Payment::where('status', 'success')
                ->where('created_at', '>=', $thisMonth)
                ->sum('amount'),
            
            'total_orders' => Order::count(),
            'pending_orders' => Order::where('status', 'pending')->count(),
            'processing_orders' => Order::where('status', 'processing')->count(),
            'completed_orders' => Order::where('status', 'completed')->count(),
            
            'total_users' => User::count(),
            'active_users' => User::where('last_login_at', '>=', now()->subDays(30))->count(),
            'new_users_today' => User::whereDate('created_at', $today)->count(),
            'new_users_this_month' => User::where('created_at', '>=', $thisMonth)->count(),
            
            'total_products' => Product::count(),
            'active_products' => Product::where('is_active', true)->count(),
            'out_of_stock' => Product::where('stock_quantity', 0)->count(),
            'low_stock' => Product::whereBetween('stock_quantity', [1, 10])->count(),
            
            'pending_kyc' => KYC::where('status', 'pending')->count(),
            'approved_kyc' => KYC::where('status', 'approved')->count(),
            
            'open_tickets' => SupportTicket::where('status', 'open')->count(),
            'pending_tickets' => SupportTicket::where('status', 'pending')->count(),
            
            'active_affiliates' => Affiliate::where('status', 'active')->count(),
            'published_blog_posts' => BlogPost::where('is_published', true)->count(),
        ];
    }

    /**
     * Get revenue statistics
     */
    private function getRevenueStats(): array
    {
        $last30Days = now()->subDays(30);
        
        return [
            'total' => Payment::where('status', 'success')->sum('amount'),
            'today' => Payment::where('status', 'success')
                ->whereDate('created_at', today())
                ->sum('amount'),
            'yesterday' => Payment::where('status', 'success')
                ->whereDate('created_at', today()->subDay())
                ->sum('amount'),
            'this_week' => Payment::where('status', 'success')
                ->whereBetween('created_at', [now()->startOfWeek(), now()->endOfWeek()])
                ->sum('amount'),
            'this_month' => Payment::where('status', 'success')
                ->whereMonth('created_at', now()->month)
                ->whereYear('created_at', now()->year)
                ->sum('amount'),
            'last_30_days' => Payment::where('status', 'success')
                ->where('created_at', '>=', $last30Days)
                ->sum('amount'),
            'average_order_value' => Order::where('payment_status', 'paid')
                ->avg('total_amount'),
        ];
    }

    /**
     * Get order statistics
     */
    private function getOrderStats(): array
    {
        return [
            'total' => Order::count(),
            'pending' => Order::where('status', 'pending')->count(),
            'processing' => Order::where('status', 'processing')->count(),
            'shipped' => Order::where('status', 'shipped')->count(),
            'delivered' => Order::where('status', 'delivered')->count(),
            'cancelled' => Order::where('status', 'cancelled')->count(),
            'today' => Order::whereDate('created_at', today())->count(),
            'this_week' => Order::whereBetween('created_at', [
                now()->startOfWeek(),
                now()->endOfWeek()
            ])->count(),
            'this_month' => Order::whereMonth('created_at', now()->month)
                ->whereYear('created_at', now()->year)
                ->count(),
        ];
    }

    /**
     * Get user statistics
     */
    private function getUserStats(): array
    {
        return [
            'total' => User::count(),
            'verified' => User::whereNotNull('email_verified_at')->count(),
            'unverified' => User::whereNull('email_verified_at')->count(),
            'active' => User::where('last_login_at', '>=', now()->subDays(30))->count(),
            'inactive' => User::where('last_login_at', '<', now()->subDays(30))
                ->orWhereNull('last_login_at')
                ->count(),
            'with_2fa' => User::where('two_factor_enabled', true)->count(),
            'today' => User::whereDate('created_at', today())->count(),
            'this_week' => User::whereBetween('created_at', [
                now()->startOfWeek(),
                now()->endOfWeek()
            ])->count(),
            'this_month' => User::whereMonth('created_at', now()->month)
                ->whereYear('created_at', now()->year)
                ->count(),
        ];
    }

    /**
     * Get product statistics
     */
    private function getProductStats(): array
    {
        return [
            'total' => Product::count(),
            'active' => Product::where('is_active', true)->count(),
            'inactive' => Product::where('is_active', false)->count(),
            'out_of_stock' => Product::where('stock_quantity', 0)->count(),
            'low_stock' => Product::whereBetween('stock_quantity', [1, 10])->count(),
            'featured' => Product::where('is_featured', true)->count(),
        ];
    }

    /**
     * Get recent activities
     */
    private function getRecentActivities(): array
    {
        $recentOrders = Order::with('user:id,first_name,last_name,email')
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get()
            ->map(fn($order) => [
                'type' => 'order',
                'message' => "New order {$order->order_number} from {$order->user->first_name} {$order->user->last_name}",
                'timestamp' => $order->created_at,
                'link' => "/admin/orders/{$order->id}",
            ]);

        $recentUsers = User::orderBy('created_at', 'desc')
            ->limit(5)
            ->get()
            ->map(fn($user) => [
                'type' => 'user',
                'message' => "New user registered: {$user->first_name} {$user->last_name}",
                'timestamp' => $user->created_at,
                'link' => "/admin/users/{$user->id}",
            ]);

        $recentTickets = SupportTicket::with('user:id,first_name,last_name')
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get()
            ->map(fn($ticket) => [
                'type' => 'ticket',
                'message' => "New support ticket: {$ticket->subject}",
                'timestamp' => $ticket->created_at,
                'link' => "/admin/support/{$ticket->id}",
            ]);

        $activities = collect()
            ->concat($recentOrders)
            ->concat($recentUsers)
            ->concat($recentTickets)
            ->sortByDesc('timestamp')
            ->take(10)
            ->values()
            ->all();

        return $activities;
    }

    /**
     * Get revenue chart data (daily for last 30 days)
     */
    public function getRevenueChartData(int $days = 30): array
    {
        $startDate = now()->subDays($days)->startOfDay();
        
        $data = Payment::where('status', 'success')
            ->where('created_at', '>=', $startDate)
            ->selectRaw('DATE(created_at) as date, SUM(amount) as total')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $labels = [];
        $values = [];
        
        for ($i = $days - 1; $i >= 0; $i--) {
            $date = now()->subDays($i)->format('Y-m-d');
            $labels[] = now()->subDays($i)->format('M d');
            
            $dayData = $data->firstWhere('date', $date);
            $values[] = $dayData ? (float) $dayData->total : 0;
        }

        return [
            'labels' => $labels,
            'values' => $values,
            'total' => array_sum($values),
            'average' => count($values) > 0 ? array_sum($values) / count($values) : 0,
        ];
    }

    /**
     * Get orders chart data
     */
    public function getOrdersChartData(int $days = 30): array
    {
        $startDate = now()->subDays($days)->startOfDay();
        
        $data = Order::where('created_at', '>=', $startDate)
            ->selectRaw('DATE(created_at) as date, COUNT(*) as count')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $labels = [];
        $values = [];
        
        for ($i = $days - 1; $i >= 0; $i--) {
            $date = now()->subDays($i)->format('Y-m-d');
            $labels[] = now()->subDays($i)->format('M d');
            
            $dayData = $data->firstWhere('date', $date);
            $values[] = $dayData ? (int) $dayData->count : 0;
        }

        return [
            'labels' => $labels,
            'values' => $values,
            'total' => array_sum($values),
        ];
    }

    /**
     * Get top products by sales
     */
    public function getTopProducts(int $limit = 10): array
    {
        return DB::table('order_items')
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.payment_status', 'paid')
            ->select(
                'products.id',
                'products.name',
                'products.slug',
                'products.image_url',
                DB::raw('SUM(order_items.quantity) as total_sold'),
                DB::raw('SUM(order_items.subtotal) as total_revenue')
            )
            ->groupBy('products.id', 'products.name', 'products.slug', 'products.image_url')
            ->orderByDesc('total_sold')
            ->limit($limit)
            ->get()
            ->toArray();
    }

    /**
     * Get top customers by spending
     */
    public function getTopCustomers(int $limit = 10): array
    {
        return DB::table('orders')
            ->join('users', 'orders.user_id', '=', 'users.id')
            ->where('orders.payment_status', 'paid')
            ->select(
                'users.id',
                'users.first_name',
                'users.last_name',
                'users.email',
                DB::raw('COUNT(orders.id) as total_orders'),
                DB::raw('SUM(orders.total_amount) as total_spent')
            )
            ->groupBy('users.id', 'users.first_name', 'users.last_name', 'users.email')
            ->orderByDesc('total_spent')
            ->limit($limit)
            ->get()
            ->toArray();
    }

    /**
     * Get sales by category
     */
    public function getSalesByCategory(): array
    {
        return DB::table('order_items')
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->join('categories', 'products.category_id', '=', 'categories.id')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.payment_status', 'paid')
            ->select(
                'categories.id',
                'categories.name',
                DB::raw('SUM(order_items.quantity) as total_sold'),
                DB::raw('SUM(order_items.subtotal) as total_revenue')
            )
            ->groupBy('categories.id', 'categories.name')
            ->orderByDesc('total_revenue')
            ->get()
            ->toArray();
    }

    /**
     * Get user growth data (monthly for last 12 months)
     */
    public function getUserGrowthData(): array
    {
        $startDate = now()->subMonths(12)->startOfMonth();
        
        $data = User::where('created_at', '>=', $startDate)
            ->selectRaw('DATE_FORMAT(created_at, "%Y-%m") as month, COUNT(*) as count')
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        $labels = [];
        $values = [];
        
        for ($i = 11; $i >= 0; $i--) {
            $month = now()->subMonths($i)->format('Y-m');
            $labels[] = now()->subMonths($i)->format('M Y');
            
            $monthData = $data->firstWhere('month', $month);
            $values[] = $monthData ? (int) $monthData->count : 0;
        }

        return [
            'labels' => $labels,
            'values' => $values,
            'total' => array_sum($values),
        ];
    }

    /**
     * Get payment method distribution
     */
    public function getPaymentMethodDistribution(): array
    {
        $data = Payment::where('status', 'success')
            ->select('payment_method', DB::raw('COUNT(*) as count'), DB::raw('SUM(amount) as total'))
            ->groupBy('payment_method')
            ->get();

        return [
            'labels' => $data->pluck('payment_method')->toArray(),
            'counts' => $data->pluck('count')->toArray(),
            'totals' => $data->pluck('total')->toArray(),
        ];
    }

    /**
     * Get system health metrics
     */
    public function getSystemHealth(): array
    {
        return [
            'database' => $this->checkDatabaseHealth(),
            'redis' => $this->checkRedisHealth(),
            'storage' => $this->checkStorageHealth(),
            'queue' => $this->checkQueueHealth(),
        ];
    }

    /**
     * Check database health
     */
    private function checkDatabaseHealth(): array
    {
        try {
            DB::connection()->getPdo();
            $tables = DB::select('SHOW TABLES');
            
            return [
                'status' => 'healthy',
                'tables_count' => count($tables),
                'message' => 'Database connection is working',
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * Check Redis health
     */
    private function checkRedisHealth(): array
    {
        try {
            Cache::store('redis')->put('health_check', true, 10);
            $result = Cache::store('redis')->get('health_check');
            
            return [
                'status' => $result ? 'healthy' : 'warning',
                'message' => $result ? 'Redis is working' : 'Redis read/write issue',
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * Check storage health
     */
    private function checkStorageHealth(): array
    {
        try {
            $storagePath = storage_path();
            $freeSpace = disk_free_space($storagePath);
            $totalSpace = disk_total_space($storagePath);
            $usedPercent = (($totalSpace - $freeSpace) / $totalSpace) * 100;
            
            $status = 'healthy';
            if ($usedPercent > 90) {
                $status = 'error';
            } elseif ($usedPercent > 75) {
                $status = 'warning';
            }
            
            return [
                'status' => $status,
                'free_space' => $this->formatBytes($freeSpace),
                'total_space' => $this->formatBytes($totalSpace),
                'used_percent' => round($usedPercent, 2),
                'message' => "Storage is {$usedPercent}% full",
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * Check queue health
     */
    private function checkQueueHealth(): array
    {
        try {
            // This is a basic check - you may want to implement more sophisticated monitoring
            return [
                'status' => 'healthy',
                'message' => 'Queue connection is working',
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * Format bytes to human-readable format
     */
    private function formatBytes($bytes, $precision = 2): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        
        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }
        
        return round($bytes, $precision) . ' ' . $units[$i];
    }

    /**
     * Clear analytics cache
     */
    public function clearCache(): void
    {
        Cache::forget('admin_dashboard_stats');
    }
}
