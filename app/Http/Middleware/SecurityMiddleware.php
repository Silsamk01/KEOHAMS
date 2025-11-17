<?php

namespace App\Http\Middleware;

use App\Services\SecurityService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityMiddleware
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

        // Skip security checks for whitelisted IPs
        if ($this->securityService->isIpWhitelisted($ip)) {
            return $next($request);
        }

        // Check if IP is blocked
        if ($this->securityService->isIpBlocked($ip)) {
            return response()->json([
                'success' => false,
                'message' => 'Access denied. Your IP address has been temporarily blocked.',
            ], 403);
        }

        // Detect suspicious activity
        $user = $request->user();
        if ($this->securityService->detectSuspiciousActivity($request, $user)) {
            // Log but don't block immediately
            // Could implement auto-blocking after multiple suspicious activities
        }

        // Add security headers to response
        $response = $next($request);

        return $this->addSecurityHeaders($response);
    }

    /**
     * Add security headers to response
     */
    protected function addSecurityHeaders(Response $response): Response
    {
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        $response->headers->set('X-XSS-Protection', '1; mode=block');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
        
        // Content Security Policy
        $csp = "default-src 'self'; " .
               "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://js.paystack.co; " .
               "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " .
               "font-src 'self' https://fonts.gstatic.com; " .
               "img-src 'self' data: https:; " .
               "connect-src 'self' https://api.paystack.co;";
        
        $response->headers->set('Content-Security-Policy', $csp);

        return $response;
    }
}
