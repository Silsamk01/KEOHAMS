<?php

namespace App\Http\Middleware;

use App\Services\SecurityService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class IpWhitelistMiddleware
{
    protected SecurityService $securityService;

    public function __construct(SecurityService $securityService)
    {
        $this->securityService = $securityService;
    }

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $ip = $request->ip();

        // Check if admin IP whitelist is enabled
        if (!config('security.admin_ip_whitelist_enabled', false)) {
            return $next($request);
        }

        // Check if IP is whitelisted
        if (!$this->securityService->isIpWhitelisted($ip)) {
            $this->securityService->logSecurityEvent('UNAUTHORIZED_ADMIN_ACCESS', [
                'ip' => $ip,
                'url' => $request->fullUrl(),
                'user_id' => $request->user()?->id,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Access denied. Your IP address is not authorized to access admin area.',
            ], 403);
        }

        return $next($request);
    }
}
