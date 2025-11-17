<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\QuotationController;
use App\Http\Controllers\KYCController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\AffiliateController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\BlogController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\WishlistController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\SupportController;
use App\Http\Controllers\UploadController;
use App\Http\Controllers\SecurityController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Public routes (no authentication required)
Route::prefix('v1')->group(function () {
    
    // Authentication routes
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/verify-2fa', [AuthController::class, 'verify2FA']);
    Route::post('/verify-email', [AuthController::class, 'verifyEmail']);
    Route::post('/resend-verification', [AuthController::class, 'resendVerification']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);

    // Public product routes
    Route::get('/products', [ProductController::class, 'index']);
    Route::get('/products/featured', [ProductController::class, 'featured']);
    Route::get('/products/{id}', [ProductController::class, 'show']);
    Route::get('/products/slug/{slug}', [ProductController::class, 'showBySlug']);
    Route::get('/products/{id}/related', [ProductController::class, 'related']);
    Route::get('/products/{id}/reviews', [ReviewController::class, 'index']);

    // Public category routes
    Route::get('/categories', [CategoryController::class, 'index']);
    Route::get('/categories/flat', [CategoryController::class, 'flat']);
    Route::get('/categories/tree', [CategoryController::class, 'tree']);
    Route::get('/categories/{id}', [CategoryController::class, 'show']);
    Route::get('/categories/slug/{slug}', [CategoryController::class, 'showBySlug']);
    Route::get('/categories/{id}/products', [CategoryController::class, 'products']);

    // Public blog routes
    Route::get('/blog', [BlogController::class, 'index']);
    Route::get('/blog/featured', [BlogController::class, 'featured']);
    Route::get('/blog/popular', [BlogController::class, 'popular']);
    Route::get('/blog/recent', [BlogController::class, 'recent']);
    Route::get('/blog/search', [BlogController::class, 'search']);
    Route::get('/blog/tags', [BlogController::class, 'tags']);
    Route::get('/blog/categories', [BlogController::class, 'categories']);
    Route::get('/blog/category/{category}', [BlogController::class, 'byCategory']);
    Route::get('/blog/tag/{tagSlug}', [BlogController::class, 'byTag']);
    Route::get('/blog/sitemap.xml', [BlogController::class, 'sitemap']);
    Route::get('/blog/rss.xml', [BlogController::class, 'rss']);
    Route::get('/blog/{slug}', [BlogController::class, 'show']);
    Route::get('/blog/{id}/related', [BlogController::class, 'related']);

    // Shared wishlist (public)
    Route::get('/wishlist/shared/{token}', [WishlistController::class, 'viewShared']);

    // Security utility routes (public)
    Route::post('/security/check-password', [SecurityController::class, 'checkPasswordStrength']);

    // Affiliate public routes
    Route::post('/affiliate/register', [AffiliateController::class, 'register']);
    Route::post('/affiliate/login', [AffiliateController::class, 'login']);
    Route::post('/affiliate/track-click', [AffiliateController::class, 'trackClick']);

    // Payment webhook (public but verified)
    Route::post('/payments/webhook', [PaymentController::class, 'webhook']);
});

// Protected routes (authentication required)
Route::prefix('v1')->middleware(['auth:sanctum'])->group(function () {
    
    // Auth user routes
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);
    Route::post('/enable-2fa', [AuthController::class, 'enable2FA']);
    Route::post('/disable-2fa', [AuthController::class, 'disable2FA']);

    // Order routes (authenticated users)
    Route::get('/orders', [OrderController::class, 'index']);
    Route::get('/orders/{id}', [OrderController::class, 'show']);
    Route::post('/orders', [OrderController::class, 'store']);
    Route::post('/orders/{id}/cancel', [OrderController::class, 'cancel']);

    // Quotation routes (authenticated users)
    Route::get('/quotations', [QuotationController::class, 'index']);
    Route::get('/quotations/{id}', [QuotationController::class, 'show']);
    Route::post('/quotations', [QuotationController::class, 'store']);
    Route::post('/quotations/{id}/cancel', [QuotationController::class, 'cancel']);

    // KYC routes (authenticated users)
    Route::get('/kyc', [KYCController::class, 'show']);
    Route::post('/kyc', [KYCController::class, 'store']);

    // Payment routes (authenticated users)
    Route::post('/payments/initialize', [PaymentController::class, 'initialize']);
    Route::post('/payments/verify', [PaymentController::class, 'verify']);
    Route::get('/payments/history', [PaymentController::class, 'history']);
    
    // New enhanced payment routes
    Route::post('/payments/initialize-order', [PaymentController::class, 'initializeOrderPayment']);
    Route::post('/payments/initialize-wallet', [PaymentController::class, 'initializeWalletTopup']);
    Route::get('/payments/verify-payment/{reference}', [PaymentController::class, 'verifyPaymentNew']);
    Route::get('/payments/statistics', [PaymentController::class, 'getPaymentStatistics']);

    // Notification routes
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::get('/notifications/statistics', [NotificationController::class, 'statistics']);
    Route::get('/notifications/preferences', [NotificationController::class, 'getPreferences']);
    Route::put('/notifications/preferences', [NotificationController::class, 'updatePreferences']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    Route::post('/notifications/bulk-read', [NotificationController::class, 'bulkMarkAsRead']);
    Route::post('/notifications/bulk-delete', [NotificationController::class, 'bulkDelete']);
    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);

    // Chat routes
    Route::get('/chat/threads', [ChatController::class, 'threads']);
    Route::post('/chat/threads', [ChatController::class, 'getOrCreateThread']);
    Route::get('/chat/threads/{id}/messages', [ChatController::class, 'messages']);
    Route::post('/chat/threads/{id}/messages', [ChatController::class, 'sendMessage']);
    Route::delete('/chat/messages/{id}', [ChatController::class, 'deleteMessage']);
    Route::post('/chat/threads/{id}/hide', [ChatController::class, 'hideThread']);
    Route::get('/chat/unread-count', [ChatController::class, 'unreadCount']);

    // Review routes
    Route::post('/reviews', [ReviewController::class, 'store']);
    Route::put('/reviews/{id}', [ReviewController::class, 'update']);
    Route::delete('/reviews/{id}', [ReviewController::class, 'destroy']);
    Route::post('/reviews/{id}/vote', [ReviewController::class, 'vote']);

    // Wishlist routes
    Route::get('/wishlist', [WishlistController::class, 'index']);
    Route::post('/wishlist/items', [WishlistController::class, 'addItem']);
    Route::delete('/wishlist/items/{id}', [WishlistController::class, 'removeItem']);
    Route::put('/wishlist/items/{id}', [WishlistController::class, 'updateItem']);
    Route::post('/wishlist/clear', [WishlistController::class, 'clear']);
    Route::post('/wishlist/share', [WishlistController::class, 'share']);
    Route::post('/wishlist/private', [WishlistController::class, 'makePrivate']);
    Route::get('/wishlist/count', [WishlistController::class, 'count']);

    // Support ticket routes
    Route::get('/support/tickets', [SupportController::class, 'index']);
    Route::get('/support/tickets/{id}', [SupportController::class, 'show']);
    Route::post('/support/tickets', [SupportController::class, 'store']);
    Route::post('/support/tickets/{id}/messages', [SupportController::class, 'addMessage']);
    Route::post('/support/tickets/{id}/close', [SupportController::class, 'close']);
    Route::post('/support/tickets/{id}/reopen', [SupportController::class, 'reopen']);

    // File upload routes
    Route::post('/uploads/avatar', [UploadController::class, 'uploadAvatar']);
    Route::post('/uploads/chat-attachment', [UploadController::class, 'uploadChatAttachment']);
    Route::get('/uploads/kyc/{userId}/{filename}', [UploadController::class, 'downloadKycDocument']);
    Route::get('/uploads/chat/{threadId}/{filename}', [UploadController::class, 'downloadChatAttachment']);
    Route::post('/uploads/file-info', [UploadController::class, 'getFileInfo']);
});

// Affiliate routes (separate authentication)
Route::prefix('v1/affiliate')->middleware(['auth:sanctum', 'affiliate'])->group(function () {
    // Dashboard & Statistics
    Route::get('/dashboard', [AffiliateController::class, 'dashboard']);
    Route::get('/stats', [AffiliateController::class, 'getStats']);
    
    // MLM & Referrals
    Route::get('/downline-tree', [AffiliateController::class, 'getDownlineTree']);
    Route::get('/referrals', [AffiliateController::class, 'getReferrals']);
    Route::get('/referral-performance', [AffiliateController::class, 'getReferralPerformance']);
    Route::get('/downline', [AffiliateController::class, 'downline']); // Legacy
    
    // Commissions
    Route::get('/commissions', [AffiliateController::class, 'commissions']); // Legacy
    Route::get('/commission-history', [AffiliateController::class, 'getCommissionHistory']);
    Route::get('/earnings-chart', [AffiliateController::class, 'getEarningsChart']);
    
    // Sales
    Route::get('/sales', [AffiliateController::class, 'sales']);
    
    // Withdrawals
    Route::get('/withdrawal-limits', [AffiliateController::class, 'getWithdrawalLimits']);
    Route::post('/withdraw', [AffiliateController::class, 'requestWithdrawal']); // Legacy
    Route::post('/withdrawal/request', [AffiliateController::class, 'requestNewWithdrawal']);
    Route::get('/withdrawals', [AffiliateController::class, 'withdrawals']); // Legacy
    Route::get('/withdrawal-history', [AffiliateController::class, 'getWithdrawalHistory']);
    Route::post('/withdrawals/{id}/cancel', [AffiliateController::class, 'cancelWithdrawal']);
});

// Admin routes
Route::prefix('v1/admin')->middleware(['auth:sanctum', 'admin'])->group(function () {
    
    // Dashboard & Analytics
    Route::get('/dashboard', [AdminController::class, 'dashboard']);
    Route::get('/activity-logs', [AdminController::class, 'activityLogs']);
    Route::get('/analytics/revenue', [AdminController::class, 'revenueAnalytics']);
    Route::get('/analytics/top-products', [AdminController::class, 'topProducts']);
    Route::get('/analytics/top-customers', [AdminController::class, 'topCustomers']);
    Route::post('/export', [AdminController::class, 'exportData']);
    Route::get('/health', [AdminController::class, 'healthCheck']);
    
    // Enhanced Analytics Routes
    Route::get('/dashboard/stats', [AdminController::class, 'getDashboardStats']);
    Route::get('/analytics/revenue-chart', [AdminController::class, 'getRevenueChart']);
    Route::get('/analytics/orders-chart', [AdminController::class, 'getOrdersChart']);
    Route::get('/analytics/top-products-enhanced', [AdminController::class, 'getTopProducts']);
    Route::get('/analytics/top-customers-enhanced', [AdminController::class, 'getTopCustomers']);
    Route::get('/analytics/sales-by-category', [AdminController::class, 'getSalesByCategory']);
    Route::get('/analytics/user-growth', [AdminController::class, 'getUserGrowth']);
    Route::get('/analytics/payment-methods', [AdminController::class, 'getPaymentMethodDistribution']);
    Route::get('/system/health', [AdminController::class, 'getSystemHealth']);
    Route::post('/analytics/clear-cache', [AdminController::class, 'clearAnalyticsCache']);

    // User management
    Route::get('/users', [AdminController::class, 'users']);
    Route::get('/users/{id}', [AdminController::class, 'userDetails']);
    Route::put('/users/{id}', [AdminController::class, 'updateUser']);
    Route::delete('/users/{id}', [AdminController::class, 'deleteUser']);
    Route::post('/users/{id}/reset-password', [AdminController::class, 'resetUserPassword']);

    // Platform settings
    Route::get('/settings', [AdminController::class, 'settings']);
    Route::post('/settings', [AdminController::class, 'updateSetting']);

    // Product management
    Route::post('/products', [ProductController::class, 'store']);
    Route::put('/products/{id}', [ProductController::class, 'update']);
    Route::delete('/products/{id}', [ProductController::class, 'destroy']);
    Route::post('/products/{id}/stock', [ProductController::class, 'updateStock']);
    Route::get('/products/low-stock', [ProductController::class, 'lowStock']);

    // Category management
    Route::post('/categories', [CategoryController::class, 'store']);
    Route::put('/categories/{id}', [CategoryController::class, 'update']);
    Route::delete('/categories/{id}', [CategoryController::class, 'destroy']);

    // Order management
    Route::get('/orders', [OrderController::class, 'adminIndex']);
    Route::put('/orders/{id}/status', [OrderController::class, 'updateStatus']);
    Route::post('/orders/{id}/ship', [OrderController::class, 'ship']);
    Route::post('/orders/{id}/deliver', [OrderController::class, 'deliver']);

    // Quotation management
    Route::get('/quotations', [QuotationController::class, 'adminIndex']);
    Route::post('/quotations/{id}/reply', [QuotationController::class, 'reply']);

    // KYC management
    Route::get('/kyc', [KYCController::class, 'index']);
    Route::get('/kyc/{id}', [KYCController::class, 'adminShow']);
    Route::put('/kyc/{id}/status', [KYCController::class, 'updateStatus']);
    Route::get('/kyc/pending-count', [KYCController::class, 'pendingCount']);

    // Payment management
    Route::get('/payments', [PaymentController::class, 'adminIndex']);
    Route::post('/payments/{id}/refund', [PaymentController::class, 'adminProcessRefund']);
    Route::get('/payments/statistics', [PaymentController::class, 'adminGetStatistics']);

    // Affiliate management
    Route::get('/affiliates', [AffiliateController::class, 'adminIndex']);
    Route::get('/affiliates/top', [AffiliateController::class, 'adminGetTopAffiliates']);
    Route::post('/affiliates/{id}/approve', [AffiliateController::class, 'approve']);
    Route::post('/affiliates/{id}/suspend', [AffiliateController::class, 'suspend']);
    Route::put('/affiliates/{id}/status', [AffiliateController::class, 'adminUpdateStatus']);
    Route::put('/affiliates/{id}/commission-rate', [AffiliateController::class, 'adminUpdateCommissionRate']);
    
    // Affiliate withdrawals management
    Route::get('/affiliate-withdrawals', [AffiliateController::class, 'adminGetWithdrawals']);
    Route::get('/affiliate-withdrawals/stats', [AffiliateController::class, 'adminGetWithdrawalStats']);
    Route::post('/affiliate-withdrawals/{id}/approve', [AffiliateController::class, 'adminApproveWithdrawal']);
    Route::post('/affiliate-withdrawals/{id}/process', [AffiliateController::class, 'adminProcessWithdrawalNew']);
    Route::post('/affiliate-withdrawals/{id}/reject', [AffiliateController::class, 'adminRejectWithdrawal']);
    Route::post('/withdrawals/{id}/process', [AffiliateController::class, 'processWithdrawal']); // Legacy

    // Notification management
    Route::post('/notifications/send', [NotificationController::class, 'send']);
    Route::post('/notifications/broadcast', [NotificationController::class, 'broadcast']);

    // Chat management
    Route::get('/chat/threads', [ChatController::class, 'adminIndex']);
    Route::post('/chat/threads/{id}/close', [ChatController::class, 'closeThread']);

    // Blog management
    Route::get('/blog', [BlogController::class, 'adminIndex']);
    Route::get('/blog/statistics', [BlogController::class, 'statistics']);
    Route::post('/blog', [BlogController::class, 'store']);
    Route::put('/blog/{id}', [BlogController::class, 'update']);
    Route::delete('/blog/{id}', [BlogController::class, 'destroy']);
    Route::post('/blog/{id}/publish', [BlogController::class, 'publish']);
    Route::post('/blog/{id}/unpublish', [BlogController::class, 'unpublish']);
    Route::post('/blog/{id}/toggle-featured', [BlogController::class, 'toggleFeatured']);
    Route::post('/blog/bulk-action', [BlogController::class, 'bulkAction']);
    Route::post('/blog/upload-cover', [BlogController::class, 'uploadCoverImage']);
    Route::post('/blog/clear-cache', [BlogController::class, 'clearCache']);

    // Review management
    Route::get('/reviews', [ReviewController::class, 'adminIndex']);
    Route::post('/reviews/{id}/approve', [ReviewController::class, 'approve']);
    Route::post('/reviews/{id}/reject', [ReviewController::class, 'reject']);

    // Support ticket management
    Route::get('/support/tickets', [SupportController::class, 'adminIndex']);
    Route::post('/support/tickets/{id}/assign', [SupportController::class, 'assign']);
    Route::put('/support/tickets/{id}/status', [SupportController::class, 'updateStatus']);
    Route::get('/support/open-count', [SupportController::class, 'openCount']);

    // Admin file upload routes
    Route::post('/uploads/product-image', [UploadController::class, 'uploadProductImage']);
    Route::post('/uploads/blog-image', [UploadController::class, 'uploadBlogImage']);
    Route::delete('/uploads/file', [UploadController::class, 'deleteFile']);

    // Security management routes
    Route::prefix('security')->group(function () {
        Route::get('/dashboard', [SecurityController::class, 'dashboard']);
        Route::get('/events', [SecurityController::class, 'events']);
        Route::get('/blocked-ips', [SecurityController::class, 'blockedIps']);
        Route::post('/block-ip', [SecurityController::class, 'blockIp']);
        Route::post('/unblock-ip', [SecurityController::class, 'unblockIp']);
        Route::get('/failed-logins', [SecurityController::class, 'failedLogins']);
        Route::get('/suspicious-activities', [SecurityController::class, 'suspiciousActivities']);
        Route::post('/clear-logs', [SecurityController::class, 'clearLogs']);
        Route::get('/export-logs', [SecurityController::class, 'exportLogs']);
        Route::get('/config', [SecurityController::class, 'getConfig']);
        Route::post('/test', [SecurityController::class, 'testSecurity']);
    });
});

// Support & Manager routes
Route::prefix('v1/staff')->middleware(['auth:sanctum', 'support'])->group(function () {
    Route::get('/support/tickets', [SupportController::class, 'adminIndex']);
    Route::post('/support/tickets/{id}/assign', [SupportController::class, 'assign']);
    Route::put('/support/tickets/{id}/status', [SupportController::class, 'updateStatus']);
    Route::get('/support/open-count', [SupportController::class, 'openCount']);
    
    Route::get('/kyc', [KYCController::class, 'index']);
    Route::get('/kyc/{id}', [KYCController::class, 'adminShow']);
    Route::put('/kyc/{id}/status', [KYCController::class, 'updateStatus']);
});
