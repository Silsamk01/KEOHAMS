<?php

namespace App\Services;

use App\Models\User;
use App\Models\ActivityLog;
use App\Models\SecurityEvent;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SecurityService
{
    private $emailService;

    public function __construct(EmailService $emailService = null)
    {
        $this->emailService = $emailService;
    }
    /**
     * Track failed login attempt
     */
    public function trackFailedLogin(string $identifier, string $ip, array $details = [])
    {
        $key = "failed_login:{$ip}:{$identifier}";
        $attempts = Cache::get($key, 0) + 1;
        
        Cache::put($key, $attempts, now()->addMinutes(30));
        
        // Log security event
        $this->logSecurityEvent('FAILED_LOGIN', [
            'identifier' => $identifier,
            'ip' => $ip,
            'attempts' => $attempts,
            'details' => $details,
        ]);
        
        // Check if IP should be blocked
        if ($attempts >= config('security.max_login_attempts', 5)) {
            $this->blockIp($ip, 'Too many failed login attempts', 60);
            
            // Send security alert if user found and alerts enabled
            if (config('security.alerts.email_on_failed_login', false)) {
                $user = User::where('email', $identifier)->first();
                if ($user && $this->emailService) {
                    $this->emailService->sendSecurityAlert($user, 'Multiple Failed Login Attempts', [
                        'attempts' => $attempts,
                        'ip' => $ip,
                        'time' => now()->format('F d, Y \a\t h:i A'),
                        'user_agent' => $details['user_agent'] ?? 'Unknown',
                    ]);
                }
            }
        }
        
        return $attempts;
    }
    
    /**
     * Clear failed login attempts
     */
    public function clearFailedLogins(string $identifier, string $ip)
    {
        $key = "failed_login:{$ip}:{$identifier}";
        Cache::forget($key);
    }
    
    /**
     * Check if IP is blocked
     */
    public function isIpBlocked(string $ip): bool
    {
        return Cache::has("blocked_ip:{$ip}");
    }
    
    /**
     * Block IP address
     */
    public function blockIp(string $ip, string $reason, int $minutes = 60)
    {
        Cache::put("blocked_ip:{$ip}", [
            'reason' => $reason,
            'blocked_at' => now(),
        ], now()->addMinutes($minutes));
        
        $this->logSecurityEvent('IP_BLOCKED', [
            'ip' => $ip,
            'reason' => $reason,
            'duration_minutes' => $minutes,
        ]);
    }
    
    /**
     * Unblock IP address
     */
    public function unblockIp(string $ip)
    {
        Cache::forget("blocked_ip:{$ip}");
        
        $this->logSecurityEvent('IP_UNBLOCKED', [
            'ip' => $ip,
        ]);
    }
    
    /**
     * Check if IP is whitelisted
     */
    public function isIpWhitelisted(string $ip): bool
    {
        $whitelist = config('security.ip_whitelist', []);
        
        foreach ($whitelist as $whitelistedIp) {
            if ($this->matchIpPattern($ip, $whitelistedIp)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Match IP against pattern (supports wildcards and CIDR)
     */
    protected function matchIpPattern(string $ip, string $pattern): bool
    {
        // Exact match
        if ($ip === $pattern) {
            return true;
        }
        
        // Wildcard match (e.g., 192.168.1.*)
        if (strpos($pattern, '*') !== false) {
            $regex = str_replace(['.', '*'], ['\.', '.*'], $pattern);
            return preg_match("/^{$regex}$/", $ip) === 1;
        }
        
        // CIDR match (e.g., 192.168.1.0/24)
        if (strpos($pattern, '/') !== false) {
            return $this->matchCidr($ip, $pattern);
        }
        
        return false;
    }
    
    /**
     * Match IP against CIDR notation
     */
    protected function matchCidr(string $ip, string $cidr): bool
    {
        list($subnet, $mask) = explode('/', $cidr);
        
        $ipLong = ip2long($ip);
        $subnetLong = ip2long($subnet);
        $maskLong = -1 << (32 - $mask);
        
        return ($ipLong & $maskLong) === ($subnetLong & $maskLong);
    }
    
    /**
     * Detect suspicious activity
     */
    public function detectSuspiciousActivity(Request $request, ?User $user = null): bool
    {
        $suspicious = false;
        $reasons = [];
        
        // Check for SQL injection patterns
        if ($this->containsSqlInjection($request)) {
            $suspicious = true;
            $reasons[] = 'SQL injection attempt detected';
        }
        
        // Check for XSS patterns
        if ($this->containsXss($request)) {
            $suspicious = true;
            $reasons[] = 'XSS attempt detected';
        }
        
        // Check for unusual user agent
        if ($this->hasUnusualUserAgent($request)) {
            $suspicious = true;
            $reasons[] = 'Unusual user agent';
        }
        
        // Check for rapid requests
        if ($this->hasRapidRequests($request->ip())) {
            $suspicious = true;
            $reasons[] = 'Rapid requests detected';
        }
        
        // Check for unusual access patterns
        if ($user && $this->hasUnusualAccessPattern($user, $request)) {
            $suspicious = true;
            $reasons[] = 'Unusual access pattern';
        }
        
        if ($suspicious) {
            $this->logSecurityEvent('SUSPICIOUS_ACTIVITY', [
                'ip' => $request->ip(),
                'user_id' => $user?->id,
                'url' => $request->fullUrl(),
                'method' => $request->method(),
                'reasons' => $reasons,
                'user_agent' => $request->userAgent(),
            ]);
        }
        
        return $suspicious;
    }
    
    /**
     * Check for SQL injection patterns
     */
    protected function containsSqlInjection(Request $request): bool
    {
        $patterns = [
            '/(\bor\b|\band\b).*?[\'"]?\s*=\s*[\'"]?/i',
            '/union.*?select/i',
            '/select.*?from/i',
            '/insert.*?into/i',
            '/delete.*?from/i',
            '/drop.*?table/i',
            '/update.*?set/i',
            '/exec(\s|\()/i',
            '/execute(\s|\()/i',
            '/script.*?>/i',
            '/--/i',
            '/\/\*/i',
        ];
        
        $allInput = json_encode($request->all());
        
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $allInput)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Check for XSS patterns
     */
    protected function containsXss(Request $request): bool
    {
        $patterns = [
            '/<script\b[^>]*>(.*?)<\/script>/is',
            '/javascript:/i',
            '/on\w+\s*=/i',
            '/<iframe/i',
            '/<embed/i',
            '/<object/i',
        ];
        
        $allInput = json_encode($request->all());
        
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $allInput)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Check for unusual user agent
     */
    protected function hasUnusualUserAgent(Request $request): bool
    {
        $userAgent = $request->userAgent();
        
        if (empty($userAgent)) {
            return true;
        }
        
        $suspiciousAgents = [
            'curl',
            'wget',
            'python',
            'perl',
            'ruby',
            'java',
            'bot',
            'spider',
            'crawler',
        ];
        
        $lowerAgent = strtolower($userAgent);
        
        foreach ($suspiciousAgents as $agent) {
            if (strpos($lowerAgent, $agent) !== false) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Check for rapid requests
     */
    protected function hasRapidRequests(string $ip): bool
    {
        $key = "request_count:{$ip}";
        $count = Cache::get($key, 0);
        
        Cache::put($key, $count + 1, now()->addMinute());
        
        // More than 60 requests per minute is suspicious
        return $count > config('security.max_requests_per_minute', 60);
    }
    
    /**
     * Check for unusual access pattern
     */
    protected function hasUnusualAccessPattern(User $user, Request $request): bool
    {
        // Check if user is accessing from unusual IP
        $lastIp = Cache::get("last_ip:{$user->id}");
        $currentIp = $request->ip();
        
        if ($lastIp && $lastIp !== $currentIp) {
            // Check if IPs are from different countries (simplified check)
            $lastIpPrefix = substr($lastIp, 0, strpos($lastIp, '.', strpos($lastIp, '.') + 1));
            $currentIpPrefix = substr($currentIp, 0, strpos($currentIp, '.', strpos($currentIp, '.') + 1));
            
            if ($lastIpPrefix !== $currentIpPrefix) {
                return true;
            }
        }
        
        Cache::put("last_ip:{$user->id}", $currentIp, now()->addHours(24));
        
        return false;
    }
    
    /**
     * Sanitize input to prevent XSS
     */
    public function sanitizeInput($input)
    {
        if (is_array($input)) {
            return array_map([$this, 'sanitizeInput'], $input);
        }
        
        if (is_string($input)) {
            // Remove dangerous tags
            $input = strip_tags($input);
            
            // Encode special characters
            $input = htmlspecialchars($input, ENT_QUOTES, 'UTF-8');
            
            return $input;
        }
        
        return $input;
    }
    
    /**
     * Validate CSRF token
     */
    public function validateCsrfToken(Request $request): bool
    {
        $token = $request->header('X-CSRF-TOKEN') 
            ?? $request->input('_token');
        
        if (!$token) {
            return false;
        }
        
        return hash_equals(
            $request->session()->token(),
            $token
        );
    }
    
    /**
     * Generate secure token
     */
    public function generateSecureToken(int $length = 32): string
    {
        return bin2hex(random_bytes($length));
    }
    
    /**
     * Hash password securely
     */
    public function hashPassword(string $password): string
    {
        return Hash::make($password);
    }
    
    /**
     * Verify password
     */
    public function verifyPassword(string $password, string $hash): bool
    {
        return Hash::check($password, $hash);
    }
    
    /**
     * Check password strength
     */
    public function checkPasswordStrength(string $password): array
    {
        $strength = 0;
        $feedback = [];
        
        // Check length
        $length = strlen($password);
        if ($length < 8) {
            $feedback[] = 'Password must be at least 8 characters';
        } elseif ($length >= 8) {
            $strength += 1;
        }
        
        if ($length >= 12) {
            $strength += 1;
        }
        
        // Check for lowercase
        if (preg_match('/[a-z]/', $password)) {
            $strength += 1;
        } else {
            $feedback[] = 'Password should contain lowercase letters';
        }
        
        // Check for uppercase
        if (preg_match('/[A-Z]/', $password)) {
            $strength += 1;
        } else {
            $feedback[] = 'Password should contain uppercase letters';
        }
        
        // Check for numbers
        if (preg_match('/\d/', $password)) {
            $strength += 1;
        } else {
            $feedback[] = 'Password should contain numbers';
        }
        
        // Check for special characters
        if (preg_match('/[^a-zA-Z\d]/', $password)) {
            $strength += 1;
        } else {
            $feedback[] = 'Password should contain special characters';
        }
        
        // Determine strength level
        $level = 'weak';
        if ($strength >= 5) {
            $level = 'strong';
        } elseif ($strength >= 3) {
            $level = 'medium';
        }
        
        return [
            'strength' => $strength,
            'level' => $level,
            'feedback' => $feedback,
            'score' => ($strength / 6) * 100,
        ];
    }
    
    /**
     * Log security event
     */
    public function logSecurityEvent(string $type, array $data = [])
    {
        SecurityEvent::create([
            'type' => $type,
            'ip_address' => request()->ip(),
            'user_id' => auth()->id(),
            'user_agent' => request()->userAgent(),
            'url' => request()->fullUrl(),
            'method' => request()->method(),
            'data' => $data,
            'severity' => $this->getEventSeverity($type),
        ]);
    }
    
    /**
     * Get event severity
     */
    protected function getEventSeverity(string $type): string
    {
        $highSeverity = [
            'FAILED_LOGIN',
            'IP_BLOCKED',
            'SUSPICIOUS_ACTIVITY',
            'UNAUTHORIZED_ACCESS',
            'SQL_INJECTION',
            'XSS_ATTEMPT',
        ];
        
        $mediumSeverity = [
            'PASSWORD_CHANGED',
            'EMAIL_CHANGED',
            'TWO_FA_DISABLED',
            'ROLE_CHANGED',
        ];
        
        if (in_array($type, $highSeverity)) {
            return 'high';
        } elseif (in_array($type, $mediumSeverity)) {
            return 'medium';
        }
        
        return 'low';
    }
    
    /**
     * Get security statistics
     */
    public function getSecurityStatistics(int $days = 30): array
    {
        $startDate = now()->subDays($days);
        
        return [
            'total_events' => SecurityEvent::where('created_at', '>=', $startDate)->count(),
            'high_severity' => SecurityEvent::where('created_at', '>=', $startDate)
                ->where('severity', 'high')->count(),
            'medium_severity' => SecurityEvent::where('created_at', '>=', $startDate)
                ->where('severity', 'medium')->count(),
            'low_severity' => SecurityEvent::where('created_at', '>=', $startDate)
                ->where('severity', 'low')->count(),
            'failed_logins' => SecurityEvent::where('created_at', '>=', $startDate)
                ->where('type', 'FAILED_LOGIN')->count(),
            'blocked_ips' => SecurityEvent::where('created_at', '>=', $startDate)
                ->where('type', 'IP_BLOCKED')->count(),
            'suspicious_activities' => SecurityEvent::where('created_at', '>=', $startDate)
                ->where('type', 'SUSPICIOUS_ACTIVITY')->count(),
            'top_blocked_ips' => SecurityEvent::where('created_at', '>=', $startDate)
                ->where('type', 'IP_BLOCKED')
                ->select('ip_address')
                ->groupBy('ip_address')
                ->orderByRaw('COUNT(*) DESC')
                ->limit(10)
                ->pluck('ip_address'),
            'events_by_day' => SecurityEvent::where('created_at', '>=', $startDate)
                ->selectRaw('DATE(created_at) as date, COUNT(*) as count')
                ->groupBy('date')
                ->orderBy('date')
                ->get(),
        ];
    }
    
    /**
     * Get recent security events
     */
    public function getRecentSecurityEvents(int $limit = 50, array $filters = []): array
    {
        $query = SecurityEvent::query();
        
        if (isset($filters['type'])) {
            $query->where('type', $filters['type']);
        }
        
        if (isset($filters['severity'])) {
            $query->where('severity', $filters['severity']);
        }
        
        if (isset($filters['ip'])) {
            $query->where('ip_address', $filters['ip']);
        }
        
        if (isset($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }
        
        return $query->with('user')
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get()
            ->toArray();
    }
    
    /**
     * Check rate limit
     */
    public function checkRateLimit(string $key, int $maxAttempts, int $decayMinutes): bool
    {
        return RateLimiter::tooManyAttempts($key, $maxAttempts);
    }
    
    /**
     * Hit rate limiter
     */
    public function hitRateLimit(string $key, int $decayMinutes): void
    {
        RateLimiter::hit($key, $decayMinutes * 60);
    }
    
    /**
     * Clear rate limiter
     */
    public function clearRateLimit(string $key): void
    {
        RateLimiter::clear($key);
    }
    
    /**
     * Encrypt sensitive data
     */
    public function encryptData($data): string
    {
        return encrypt($data);
    }
    
    /**
     * Decrypt sensitive data
     */
    public function decryptData(string $encrypted)
    {
        return decrypt($encrypted);
    }
    
    /**
     * Generate API key
     */
    public function generateApiKey(): string
    {
        return 'sk_' . Str::random(32);
    }
    
    /**
     * Validate API key
     */
    public function validateApiKey(string $apiKey): bool
    {
        // Implementation depends on your API key storage
        return User::where('api_key', $apiKey)->exists();
    }
}
