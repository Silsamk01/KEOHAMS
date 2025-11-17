<?php

namespace App\Http\Controllers;

use App\Services\SecurityService;
use App\Models\SecurityEvent;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class SecurityController extends Controller
{
    private SecurityService $securityService;

    public function __construct(SecurityService $securityService)
    {
        $this->securityService = $securityService;
    }

    /**
     * Get security dashboard statistics
     */
    public function dashboard(Request $request)
    {
        try {
            $days = $request->input('days', 30);
            $stats = $this->securityService->getSecurityStatistics($days);

            return response()->json([
                'success' => true,
                'data' => $stats
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve security statistics.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get recent security events
     */
    public function events(Request $request)
    {
        try {
            $limit = $request->input('limit', 50);
            $filters = $request->only(['type', 'severity', 'ip', 'user_id']);

            $events = $this->securityService->getRecentSecurityEvents($limit, $filters);

            return response()->json([
                'success' => true,
                'data' => $events
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve security events.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get blocked IPs
     */
    public function blockedIps(Request $request)
    {
        try {
            $blockedIps = [];
            $keys = Cache::get('blocked_ips_list', []);

            foreach ($keys as $ip) {
                $data = Cache::get("blocked_ip:{$ip}");
                if ($data) {
                    $blockedIps[] = array_merge(['ip' => $ip], $data);
                }
            }

            return response()->json([
                'success' => true,
                'data' => $blockedIps
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve blocked IPs.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Block IP address
     */
    public function blockIp(Request $request)
    {
        try {
            $validated = $request->validate([
                'ip' => 'required|ip',
                'reason' => 'required|string|max:255',
                'duration' => 'required|integer|min:1|max:43200', // Max 30 days
            ]);

            $this->securityService->blockIp(
                $validated['ip'],
                $validated['reason'],
                $validated['duration']
            );

            ActivityLog::log('IP_BLOCKED_MANUAL', $request->user()->id, 'IP address blocked manually', [
                'ip' => $validated['ip'],
                'reason' => $validated['reason'],
                'duration' => $validated['duration'],
            ]);

            return response()->json([
                'success' => true,
                'message' => 'IP address blocked successfully.'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to block IP address.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Unblock IP address
     */
    public function unblockIp(Request $request)
    {
        try {
            $validated = $request->validate([
                'ip' => 'required|ip',
            ]);

            $this->securityService->unblockIp($validated['ip']);

            ActivityLog::log('IP_UNBLOCKED', $request->user()->id, 'IP address unblocked', [
                'ip' => $validated['ip'],
            ]);

            return response()->json([
                'success' => true,
                'message' => 'IP address unblocked successfully.'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to unblock IP address.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Check password strength
     */
    public function checkPasswordStrength(Request $request)
    {
        try {
            $validated = $request->validate([
                'password' => 'required|string',
            ]);

            $result = $this->securityService->checkPasswordStrength($validated['password']);

            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to check password strength.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get failed login attempts
     */
    public function failedLogins(Request $request)
    {
        try {
            $days = $request->input('days', 7);

            $failedLogins = SecurityEvent::where('type', 'FAILED_LOGIN')
                ->where('created_at', '>=', now()->subDays($days))
                ->with('user')
                ->orderBy('created_at', 'desc')
                ->paginate(50);

            return response()->json([
                'success' => true,
                'data' => $failedLogins
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve failed logins.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get suspicious activities
     */
    public function suspiciousActivities(Request $request)
    {
        try {
            $days = $request->input('days', 7);

            $activities = SecurityEvent::where('type', 'SUSPICIOUS_ACTIVITY')
                ->where('created_at', '>=', now()->subDays($days))
                ->with('user')
                ->orderBy('created_at', 'desc')
                ->paginate(50);

            return response()->json([
                'success' => true,
                'data' => $activities
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve suspicious activities.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Clear security logs
     */
    public function clearLogs(Request $request)
    {
        try {
            $validated = $request->validate([
                'days' => 'required|integer|min:1',
            ]);

            $deleted = SecurityEvent::where('created_at', '<', now()->subDays($validated['days']))
                ->delete();

            ActivityLog::log('SECURITY_LOGS_CLEARED', $request->user()->id, 'Security logs cleared', [
                'days' => $validated['days'],
                'records_deleted' => $deleted,
            ]);

            return response()->json([
                'success' => true,
                'message' => "Deleted {$deleted} old security logs."
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to clear logs.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Export security logs
     */
    public function exportLogs(Request $request)
    {
        try {
            $days = $request->input('days', 30);
            $format = $request->input('format', 'csv');

            $events = SecurityEvent::where('created_at', '>=', now()->subDays($days))
                ->with('user')
                ->orderBy('created_at', 'desc')
                ->get();

            if ($format === 'json') {
                return response()->json([
                    'success' => true,
                    'data' => $events
                ]);
            }

            // CSV format
            $csv = "ID,Type,Severity,IP Address,User,URL,Method,Created At\n";
            foreach ($events as $event) {
                $csv .= implode(',', [
                    $event->id,
                    $event->type,
                    $event->severity,
                    $event->ip_address,
                    $event->user ? $event->user->email : 'N/A',
                    str_replace(',', ';', $event->url ?? ''),
                    $event->method ?? '',
                    $event->created_at->toDateTimeString(),
                ]) . "\n";
            }

            return response($csv)
                ->header('Content-Type', 'text/csv')
                ->header('Content-Disposition', 'attachment; filename="security_logs_' . now()->format('Y-m-d') . '.csv"');
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to export logs.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get security configuration
     */
    public function getConfig(Request $request)
    {
        try {
            $config = [
                'max_login_attempts' => config('security.max_login_attempts'),
                'login_lockout_minutes' => config('security.login_lockout_minutes'),
                'max_requests_per_minute' => config('security.max_requests_per_minute'),
                'admin_ip_whitelist_enabled' => config('security.admin_ip_whitelist_enabled'),
                'ip_whitelist' => config('security.ip_whitelist'),
                'password_requirements' => config('security.password'),
                'two_factor_enabled' => config('security.two_factor.enabled'),
                'csrf_enabled' => config('security.csrf.enabled'),
                'xss_enabled' => config('security.xss.enabled'),
                'logging' => config('security.logging'),
                'alerts' => config('security.alerts'),
            ];

            return response()->json([
                'success' => true,
                'data' => $config
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve security configuration.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Test security feature
     */
    public function testSecurity(Request $request)
    {
        try {
            $testType = $request->input('test_type');
            $result = [];

            switch ($testType) {
                case 'sql_injection':
                    $result = $this->securityService->containsSqlInjection($request);
                    break;
                case 'xss':
                    $result = $this->securityService->containsXss($request);
                    break;
                case 'rate_limit':
                    $key = 'test:' . $request->ip();
                    $result = $this->securityService->checkRateLimit($key, 5, 1);
                    break;
                case 'password_strength':
                    $password = $request->input('password', 'test123');
                    $result = $this->securityService->checkPasswordStrength($password);
                    break;
                default:
                    return response()->json([
                        'success' => false,
                        'message' => 'Invalid test type'
                    ], 400);
            }

            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Security test failed.',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
