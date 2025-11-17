<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\ActivityLog;
use App\Mail\VerificationEmail;
use App\Mail\TwoFactorCodeEmail;
use App\Mail\PasswordResetEmail;
use App\Services\SecurityService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    private SecurityService $securityService;

    public function __construct(SecurityService $securityService)
    {
        $this->securityService = $securityService;
    }
    /**
     * Register a new user
     */
    public function register(Request $request)
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100', 'regex:/^[a-zA-Z\\s\\-\']+$/'],
            'last_name' => ['required', 'string', 'max:100', 'regex:/^[a-zA-Z\\s\\-\']+$/'],
            'email' => ['required', 'email:rfc,dns', 'unique:users,email', 'max:255'],
            'password' => [
                'required',
                'string',
                'min:8',
                'confirmed',
                'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]+$/'
            ],
            'phone' => ['nullable', 'string', 'max:20', 'regex:/^[\\d\\s\\+\\-\\(\\)]+$/'],
            'dob' => ['nullable', 'date', 'before:today', 'after:1900-01-01'],
            'address' => ['nullable', 'string', 'max:500'],
            'state' => ['nullable', 'string', 'max:100'],
            'country' => ['nullable', 'string', 'max:100', 'alpha'],
        ], [
            'password.regex' => 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&).',
            'first_name.regex' => 'First name can only contain letters, spaces, hyphens, and apostrophes.',
            'last_name.regex' => 'Last name can only contain letters, spaces, hyphens, and apostrophes.',
            'phone.regex' => 'Phone number format is invalid.',
        ]);

        // Validate age if DOB provided
        if (isset($validated['dob'])) {
            $age = \Carbon\Carbon::parse($validated['dob'])->age;
            if ($age < 18) {
                return response()->json([
                    'message' => 'You must be at least 18 years old to register.',
                ], 422);
            }
        }

        // Sanitize text inputs
        $validated['first_name'] = strip_tags($validated['first_name']);
        $validated['last_name'] = strip_tags($validated['last_name']);

        $user = User::create([
            'first_name' => $validated['first_name'],
            'last_name' => $validated['last_name'],
            'email' => $validated['email'],
            'password' => $validated['password'], // Auto-hashed by mutator
            'phone' => $validated['phone'] ?? null,
            'dob' => $validated['dob'] ?? null,
            'address' => $validated['address'] ?? null,
            'state' => $validated['state'] ?? null,
            'country' => $validated['country'] ?? null,
            'role' => 'CUSTOMER',
            'email_verification_token' => Str::random(64),
        ]);

        // Send verification email
        // Mail::to($user->email)->send(new VerificationEmail($user));

        ActivityLog::log('USER_REGISTERED', $user->id, 'User registered', ['email' => $user->email]);

        return response()->json([
            'message' => 'Registration successful. Please check your email to verify your account.',
            'user' => [
                'id' => $user->id,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
            ]
        ], 201);
    }

    /**
     * Login user
     */
    public function login(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $ip = $request->ip();

        // Check if IP is blocked
        if ($this->securityService->isIpBlocked($ip)) {
            return response()->json([
                'message' => 'Access denied. Your IP address has been temporarily blocked due to multiple failed login attempts.',
            ], 403);
        }

        $user = User::where('email', $validated['email'])->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            // Track failed login attempt
            $this->securityService->trackFailedLogin(
                $validated['email'],
                $ip,
                [
                    'user_agent' => $request->userAgent(),
                    'url' => $request->fullUrl(),
                ]
            );

            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        // Check if email is verified
        if (!$user->email_verified) {
            return response()->json([
                'message' => 'Please verify your email address before logging in.',
                'requires_verification' => true,
                'email' => $user->email,
            ], 403);
        }

        // Clear failed login attempts on successful authentication
        $this->securityService->clearFailedLogins($validated['email'], $ip);

        // Check if 2FA is enabled
        if ($user->two_factor_enabled) {
            // Generate 2FA code
            $code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $user->two_factor_code = Hash::make($code);
            $user->two_factor_expires_at = now()->addMinutes(10);
            $user->save();

            // Send 2FA code via email (queued)
            Mail::to($user->email)->queue(new TwoFactorCodeEmail($user, $code));

            ActivityLog::log('TWO_FACTOR_CODE_SENT', $user->id, '2FA code sent');

            return response()->json([
                'message' => 'Two-factor authentication code sent to your email.',
                'requires_2fa' => true,
                'user_id' => $user->id,
            ]);
        }

        // Create token
        $token = $user->createToken('auth-token', ['*'], now()->addDays(30))->plainTextToken;

        ActivityLog::log('USER_LOGIN', $user->id, 'User logged in');

        return response()->json([
            'message' => 'Login successful.',
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'role' => $user->role,
                'email_verified' => $user->email_verified,
                'has_two_factor' => $user->has_two_factor,
            ]
        ]);
    }

    /**
     * Verify 2FA code and complete login
     */
    public function verify2FA(Request $request)
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'code' => 'required|string|size:6',
        ]);

        $user = User::findOrFail($validated['user_id']);

        if (!$user->two_factor_code || !$user->two_factor_expires_at) {
            return response()->json(['message' => 'No 2FA code found.'], 400);
        }

        if (now()->greaterThan($user->two_factor_expires_at)) {
            return response()->json(['message' => '2FA code has expired.'], 400);
        }

        if (!Hash::check($validated['code'], $user->two_factor_code)) {
            // Track failed 2FA attempt
            $this->securityService->trackFailedLogin(
                $user->email,
                $request->ip(),
                [
                    'type' => '2FA',
                    'user_agent' => $request->userAgent(),
                ]
            );

            return response()->json(['message' => 'Invalid 2FA code.'], 400);
        }

        // Clear failed login attempts on successful 2FA
        $this->securityService->clearFailedLogins($user->email, $request->ip());

        // Clear 2FA code
        $user->two_factor_code = null;
        $user->two_factor_expires_at = null;
        $user->save();

        // Create token
        $token = $user->createToken('auth-token', ['*'], now()->addDays(30))->plainTextToken;

        ActivityLog::log('TWO_FACTOR_VERIFIED', $user->id, '2FA verified and logged in');

        return response()->json([
            'message' => 'Two-factor authentication successful.',
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'role' => $user->role,
                'email_verified' => $user->email_verified,
                'has_two_factor' => $user->has_two_factor,
            ]
        ]);
    }

    /**
     * Logout user
     */
    public function logout(Request $request)
    {
        $user = $request->user();
        
        // Delete current access token
        $request->user()->currentAccessToken()->delete();

        ActivityLog::log('USER_LOGOUT', $user->id, 'User logged out');

        return response()->json(['message' => 'Logged out successfully.']);
    }

    /**
     * Get authenticated user
     */
    public function me(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'user' => [
                'id' => $user->id,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role,
                'email_verified' => $user->email_verified,
                'has_two_factor' => $user->has_two_factor,
                'avatar_url' => $user->avatar_url,
                'created_at' => $user->created_at,
            ]
        ]);
    }

    /**
     * Verify email
     */
    public function verifyEmail(Request $request)
    {
        $validated = $request->validate([
            'token' => 'required|string',
        ]);

        $user = User::where('email_verification_token', $validated['token'])->first();

        if (!$user) {
            return response()->json(['message' => 'Invalid verification token.'], 400);
        }

        if ($user->email_verified) {
            return response()->json(['message' => 'Email already verified.'], 400);
        }

        $user->email_verified = true;
        $user->email_verification_token = null;
        $user->save();

        ActivityLog::log('EMAIL_VERIFIED', $user->id, 'Email verified');

        return response()->json(['message' => 'Email verified successfully.']);
    }

    /**
     * Resend verification email
     */
    public function resendVerification(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email|exists:users,email',
        ]);

        $user = User::where('email', $validated['email'])->first();

        if ($user->email_verified) {
            return response()->json(['message' => 'Email already verified.'], 400);
        }

        $user->email_verification_token = Str::random(64);
        $user->save();

        // Send verification email
        Mail::to($user->email)->queue(new VerificationEmail($user, $user->email_verification_token));

        ActivityLog::log('VERIFICATION_EMAIL_RESENT', $user->id, 'Verification email resent');

        return response()->json(['message' => 'Verification email sent.']);
    }

    /**
     * Request password reset
     */
    public function forgotPassword(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email|exists:users,email',
        ]);

        $user = User::where('email', $validated['email'])->first();

        $user->password_reset_token = Str::random(64);
        $user->password_reset_expires = now()->addHour();
        $user->save();

        // Send password reset email
        Mail::to($user->email)->queue(new PasswordResetEmail($user, $user->password_reset_token));

        ActivityLog::log('PASSWORD_RESET_REQUESTED', $user->id, 'Password reset requested');

        return response()->json(['message' => 'Password reset link sent to your email.']);
    }

    /**
     * Reset password
     */
    public function resetPassword(Request $request)
    {
        $validated = $request->validate([
            'token' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = User::where('password_reset_token', $validated['token'])->first();

        if (!$user) {
            return response()->json(['message' => 'Invalid reset token.'], 400);
        }

        if (now()->greaterThan($user->password_reset_expires)) {
            return response()->json(['message' => 'Reset token has expired.'], 400);
        }

        $user->password = $validated['password']; // Auto-hashed by mutator
        $user->password_reset_token = null;
        $user->password_reset_expires = null;
        $user->incrementTokenVersion(); // Invalidate all existing tokens
        $user->save();

        ActivityLog::log('PASSWORD_RESET', $user->id, 'Password reset successfully');

        return response()->json(['message' => 'Password reset successfully.']);
    }

    /**
     * Enable 2FA
     */
    public function enable2FA(Request $request)
    {
        $user = $request->user();

        $user->two_factor_enabled = true;
        $user->save();

        ActivityLog::log('TWO_FACTOR_ENABLED', $user->id, '2FA enabled');

        return response()->json(['message' => 'Two-factor authentication enabled.']);
    }

    /**
     * Disable 2FA
     */
    public function disable2FA(Request $request)
    {
        $user = $request->user();

        $user->two_factor_enabled = false;
        $user->two_factor_secret = null;
        $user->two_factor_code = null;
        $user->two_factor_expires_at = null;
        $user->recovery_codes = null;
        $user->save();

        ActivityLog::log('TWO_FACTOR_DISABLED', $user->id, '2FA disabled');

        return response()->json(['message' => 'Two-factor authentication disabled.']);
    }

    /**
     * Change password (authenticated user)
     */
    public function changePassword(Request $request)
    {
        $validated = $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        $user = $request->user();

        if (!Hash::check($validated['current_password'], $user->password)) {
            return response()->json(['message' => 'Current password is incorrect.'], 400);
        }

        $user->password = $validated['new_password'];
        $user->incrementTokenVersion(); // Invalidate all existing tokens except current
        $user->save();

        ActivityLog::log('PASSWORD_CHANGED', $user->id, 'Password changed');

        return response()->json(['message' => 'Password changed successfully.']);
    }
}
