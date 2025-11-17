<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AffiliateMiddleware
{
    /**
     * Handle an incoming request for affiliate routes
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Check if user is authenticated via Sanctum (AffiliateAccount uses HasApiTokens)
        if (!$request->user()) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        // Check if the authenticated user is an AffiliateAccount
        if (!($request->user() instanceof \App\Models\AffiliateAccount)) {
            return response()->json(['message' => 'Unauthorized. Affiliate access required.'], 403);
        }

        // Check if affiliate account is active
        if ($request->user()->status !== 'ACTIVE') {
            return response()->json([
                'message' => 'Your affiliate account is ' . strtolower($request->user()->status) . '.',
                'status' => $request->user()->status
            ], 403);
        }

        return $next($request);
    }
}
