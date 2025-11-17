<?php

namespace App\Services;

use App\Models\User;
use App\Models\Order;
use App\Models\Product;
use App\Mail\WelcomeEmail;
use App\Mail\OrderConfirmationEmail;
use App\Mail\OrderStatusEmail;
use App\Mail\KYCStatusEmail;
use App\Mail\PasswordResetEmail;
use App\Mail\VerificationEmail;
use App\Mail\TwoFactorCodeEmail;
use App\Mail\AffiliateWelcomeEmail;
use App\Mail\AffiliateApprovedEmail;
use App\Mail\AffiliateCommissionEmail;
use App\Mail\AffiliateWithdrawalEmail;
use App\Mail\SecurityAlertEmail;
use App\Mail\NewsletterEmail;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

class EmailService
{
    /**
     * Send welcome email to new user
     */
    public function sendWelcomeEmail(User $user): bool
    {
        try {
            Mail::to($user->email)->queue(new WelcomeEmail($user));
            Log::info("Welcome email queued for user: {$user->email}");
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to send welcome email: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Send email verification
     */
    public function sendVerificationEmail(User $user, string $verificationUrl): bool
    {
        try {
            Mail::to($user->email)->queue(new VerificationEmail($user, $verificationUrl));
            Log::info("Verification email queued for user: {$user->email}");
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to send verification email: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Send 2FA code
     */
    public function sendTwoFactorCode(User $user, string $code): bool
    {
        try {
            Mail::to($user->email)->queue(new TwoFactorCodeEmail($user, $code));
            Log::info("2FA code email queued for user: {$user->email}");
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to send 2FA code email: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Send password reset email
     */
    public function sendPasswordResetEmail(User $user, string $resetUrl): bool
    {
        try {
            Mail::to($user->email)->queue(new PasswordResetEmail($user, $resetUrl));
            Log::info("Password reset email queued for user: {$user->email}");
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to send password reset email: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Send order confirmation email
     */
    public function sendOrderConfirmation(Order $order): bool
    {
        try {
            Mail::to($order->user->email)->queue(new OrderConfirmationEmail($order));
            Log::info("Order confirmation email queued for order: {$order->order_number}");
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to send order confirmation email: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Send order status update email
     */
    public function sendOrderStatusUpdate(Order $order): bool
    {
        try {
            Mail::to($order->user->email)->queue(new OrderStatusEmail($order));
            Log::info("Order status email queued for order: {$order->order_number}");
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to send order status email: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Send KYC status notification
     */
    public function sendKYCStatusEmail($kyc): bool
    {
        try {
            Mail::to($kyc->user->email)->queue(new KYCStatusEmail($kyc));
            Log::info("KYC status email queued for user: {$kyc->user->email}");
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to send KYC status email: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Send affiliate welcome email
     */
    public function sendAffiliateWelcomeEmail($affiliate): bool
    {
        try {
            Mail::to($affiliate->user->email)->queue(new AffiliateWelcomeEmail($affiliate));
            Log::info("Affiliate welcome email queued for: {$affiliate->user->email}");
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to send affiliate welcome email: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Send affiliate approval email
     */
    public function sendAffiliateApprovedEmail($affiliate): bool
    {
        try {
            Mail::to($affiliate->user->email)->queue(new AffiliateApprovedEmail($affiliate));
            Log::info("Affiliate approval email queued for: {$affiliate->user->email}");
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to send affiliate approval email: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Send affiliate commission notification
     */
    public function sendAffiliateCommissionEmail($affiliate, $commission): bool
    {
        try {
            Mail::to($affiliate->user->email)->queue(new AffiliateCommissionEmail($affiliate, $commission));
            Log::info("Commission email queued for affiliate: {$affiliate->user->email}");
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to send commission email: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Send affiliate withdrawal status email
     */
    public function sendAffiliateWithdrawalEmail($withdrawal): bool
    {
        try {
            Mail::to($withdrawal->affiliate->user->email)->queue(new AffiliateWithdrawalEmail($withdrawal));
            Log::info("Withdrawal email queued for: {$withdrawal->affiliate->user->email}");
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to send withdrawal email: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Send security alert email
     */
    public function sendSecurityAlert(User $user, string $alertType, array $details = []): bool
    {
        try {
            Mail::to($user->email)->queue(new SecurityAlertEmail($user, $alertType, $details));
            Log::info("Security alert email queued for user: {$user->email}, type: {$alertType}");
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to send security alert email: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Send newsletter
     */
    public function sendNewsletter($newsletter, $subscriber, array $featuredProducts = []): bool
    {
        try {
            $email = is_object($subscriber) ? $subscriber->email : $subscriber;
            Mail::to($email)->queue(new NewsletterEmail($newsletter, $subscriber, $featuredProducts));
            Log::info("Newsletter email queued for: {$email}");
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to send newsletter email: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Send bulk newsletters to multiple subscribers
     */
    public function sendBulkNewsletter($newsletter, array $subscribers, array $featuredProducts = []): array
    {
        $results = [
            'success' => 0,
            'failed' => 0,
            'errors' => []
        ];

        foreach ($subscribers as $subscriber) {
            if ($this->sendNewsletter($newsletter, $subscriber, $featuredProducts)) {
                $results['success']++;
            } else {
                $results['failed']++;
                $email = is_object($subscriber) ? $subscriber->email : $subscriber;
                $results['errors'][] = $email;
            }
        }

        Log::info("Bulk newsletter sent: {$results['success']} successful, {$results['failed']} failed");
        return $results;
    }

    /**
     * Send test email to verify configuration
     */
    public function sendTestEmail(string $email): bool
    {
        try {
            Mail::raw('This is a test email from ' . config('app.name') . '. If you received this, your email configuration is working correctly!', function ($message) use ($email) {
                $message->to($email)
                        ->subject('Test Email from ' . config('app.name'));
            });
            
            Log::info("Test email sent to: {$email}");
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to send test email: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Get email statistics
     */
    public function getEmailStatistics(): array
    {
        // This would typically pull from a mail tracking system
        // For now, return basic info from logs
        return [
            'total_sent' => 0, // Would be tracked in database
            'total_queued' => 0,
            'total_failed' => 0,
            'last_sent' => null,
        ];
    }
}
