<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerificationTierMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @param  string  $tier  Required verification tier (BASIC_VERIFIED, KYC_VERIFIED)
     */
    public function handle(Request $request, Closure $next, string $tier = 'BASIC_VERIFIED'): Response
    {
        if (!$request->user()) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $user = $request->user();

        // Check if user has verification state
        if (!$user->verificationState) {
            return response()->json([
                'message' => 'Account verification required.',
                'required_tier' => $tier,
                'current_tier' => 'UNVERIFIED'
            ], 403);
        }

        $currentTier = $user->verificationState->verification_tier;

        // Tier hierarchy: UNVERIFIED < BASIC_VERIFIED < KYC_VERIFIED
        $tierHierarchy = [
            'UNVERIFIED' => 0,
            'BASIC_VERIFIED' => 1,
            'KYC_VERIFIED' => 2,
        ];

        $requiredLevel = $tierHierarchy[$tier] ?? 1;
        $currentLevel = $tierHierarchy[$currentTier] ?? 0;

        if ($currentLevel < $requiredLevel) {
            return response()->json([
                'message' => 'Higher verification tier required.',
                'required_tier' => $tier,
                'current_tier' => $currentTier
            ], 403);
        }

        return $next($request);
    }
}
