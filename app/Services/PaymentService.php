<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class PaymentService
{
    private string $secretKey;
    private string $baseUrl;

    public function __construct()
    {
        $this->secretKey = config('paystack.secret_key');
        $this->baseUrl = config('paystack.base_url');
    }

    /**
     * Initialize a payment transaction
     */
    public function initializePayment(array $data): array
    {
        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->secretKey,
                'Content-Type' => 'application/json',
            ])->post($this->baseUrl . '/transaction/initialize', [
                'email' => $data['email'],
                'amount' => $data['amount'] * 100, // Convert to kobo/pesewas
                'currency' => $data['currency'] ?? config('paystack.default_currency'),
                'reference' => $data['reference'],
                'callback_url' => $data['callback_url'] ?? config('paystack.callback_url'),
                'metadata' => $data['metadata'] ?? [],
                'channels' => $data['channels'] ?? config('paystack.channels'),
            ]);

            $result = $response->json();

            if ($result['status'] ?? false) {
                return [
                    'success' => true,
                    'authorization_url' => $result['data']['authorization_url'],
                    'access_code' => $result['data']['access_code'],
                    'reference' => $result['data']['reference'],
                ];
            }

            return [
                'success' => false,
                'message' => $result['message'] ?? 'Payment initialization failed',
            ];
        } catch (\Exception $e) {
            Log::error('Paystack initialization error: ' . $e->getMessage());
            return [
                'success' => false,
                'message' => 'Payment initialization failed. Please try again.',
            ];
        }
    }

    /**
     * Verify a payment transaction
     */
    public function verifyPayment(string $reference): array
    {
        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->secretKey,
            ])->get($this->baseUrl . '/transaction/verify/' . $reference);

            $result = $response->json();

            if ($result['status'] ?? false) {
                $data = $result['data'];
                return [
                    'success' => true,
                    'reference' => $data['reference'],
                    'amount' => $data['amount'] / 100, // Convert from kobo
                    'currency' => $data['currency'],
                    'status' => $data['status'],
                    'paid_at' => $data['paid_at'] ?? null,
                    'channel' => $data['channel'] ?? null,
                    'ip_address' => $data['ip_address'] ?? null,
                    'metadata' => $data['metadata'] ?? [],
                    'fees' => $data['fees'] / 100,
                    'customer' => $data['customer'] ?? [],
                    'authorization' => $data['authorization'] ?? [],
                ];
            }

            return [
                'success' => false,
                'message' => $result['message'] ?? 'Payment verification failed',
            ];
        } catch (\Exception $e) {
            Log::error('Paystack verification error: ' . $e->getMessage());
            return [
                'success' => false,
                'message' => 'Payment verification failed. Please try again.',
            ];
        }
    }

    /**
     * Process order payment
     */
    public function processOrderPayment(Order $order, User $user): array
    {
        DB::beginTransaction();
        try {
            // Generate unique reference
            $reference = $this->generateReference('ORD');

            // Create payment record
            $payment = Payment::create([
                'reference' => $reference,
                'user_id' => $user->id,
                'order_id' => $order->id,
                'amount' => $order->total_amount,
                'currency' => 'NGN',
                'payment_method' => 'paystack',
                'status' => 'pending',
                'metadata' => [
                    'order_number' => $order->order_number,
                    'items_count' => $order->items->count(),
                ],
            ]);

            // Initialize payment with Paystack
            $initialization = $this->initializePayment([
                'email' => $user->email,
                'amount' => $order->total_amount,
                'reference' => $reference,
                'metadata' => [
                    'order_id' => $order->id,
                    'user_id' => $user->id,
                    'custom_fields' => [
                        [
                            'display_name' => 'Order Number',
                            'variable_name' => 'order_number',
                            'value' => $order->order_number,
                        ],
                    ],
                ],
            ]);

            if (!$initialization['success']) {
                $payment->update([
                    'status' => 'failed',
                    'failure_reason' => $initialization['message'],
                ]);
                DB::rollBack();
                return $initialization;
            }

            // Update payment with access code
            $payment->update([
                'access_code' => $initialization['access_code'],
            ]);

            DB::commit();

            return [
                'success' => true,
                'payment_id' => $payment->id,
                'authorization_url' => $initialization['authorization_url'],
                'reference' => $reference,
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Process order payment error: ' . $e->getMessage());
            return [
                'success' => false,
                'message' => 'Failed to process payment. Please try again.',
            ];
        }
    }

    /**
     * Process wallet top-up payment
     */
    public function processWalletTopup(float $amount, User $user): array
    {
        DB::beginTransaction();
        try {
            // Generate unique reference
            $reference = $this->generateReference('WLT');

            // Create payment record
            $payment = Payment::create([
                'reference' => $reference,
                'user_id' => $user->id,
                'amount' => $amount,
                'currency' => 'NGN',
                'payment_method' => 'paystack',
                'status' => 'pending',
                'metadata' => [
                    'type' => 'wallet_topup',
                ],
            ]);

            // Initialize payment with Paystack
            $initialization = $this->initializePayment([
                'email' => $user->email,
                'amount' => $amount,
                'reference' => $reference,
                'metadata' => [
                    'user_id' => $user->id,
                    'type' => 'wallet_topup',
                ],
            ]);

            if (!$initialization['success']) {
                $payment->update([
                    'status' => 'failed',
                    'failure_reason' => $initialization['message'],
                ]);
                DB::rollBack();
                return $initialization;
            }

            // Update payment with access code
            $payment->update([
                'access_code' => $initialization['access_code'],
            ]);

            DB::commit();

            return [
                'success' => true,
                'payment_id' => $payment->id,
                'authorization_url' => $initialization['authorization_url'],
                'reference' => $reference,
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Process wallet topup error: ' . $e->getMessage());
            return [
                'success' => false,
                'message' => 'Failed to process wallet top-up. Please try again.',
            ];
        }
    }

    /**
     * Handle successful payment
     */
    public function handleSuccessfulPayment(string $reference): array
    {
        DB::beginTransaction();
        try {
            // Verify payment with Paystack
            $verification = $this->verifyPayment($reference);

            if (!$verification['success']) {
                DB::rollBack();
                return $verification;
            }

            // Find payment record
            $payment = Payment::where('reference', $reference)->first();

            if (!$payment) {
                DB::rollBack();
                return [
                    'success' => false,
                    'message' => 'Payment record not found',
                ];
            }

            // Check if already processed
            if ($payment->status === 'success') {
                DB::commit();
                return [
                    'success' => true,
                    'message' => 'Payment already processed',
                    'payment' => $payment,
                ];
            }

            // Update payment record
            $payment->update([
                'status' => $verification['status'] === 'success' ? 'success' : 'failed',
                'paid_at' => $verification['paid_at'],
                'channel' => $verification['channel'],
                'ip_address' => $verification['ip_address'],
                'fees' => $verification['fees'],
                'gateway_response' => $verification,
            ]);

            if ($verification['status'] === 'success') {
                // Process based on payment type
                if ($payment->order_id) {
                    $this->completeOrderPayment($payment);
                } elseif (($payment->metadata['type'] ?? '') === 'wallet_topup') {
                    $this->completeWalletTopup($payment);
                }

                DB::commit();

                return [
                    'success' => true,
                    'message' => 'Payment processed successfully',
                    'payment' => $payment->fresh(),
                ];
            }

            DB::rollBack();
            return [
                'success' => false,
                'message' => 'Payment verification failed',
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Handle successful payment error: ' . $e->getMessage());
            return [
                'success' => false,
                'message' => 'Failed to process payment verification.',
            ];
        }
    }

    /**
     * Complete order payment
     */
    private function completeOrderPayment(Payment $payment): void
    {
        $order = $payment->order;

        if (!$order) {
            return;
        }

        // Update order status
        $order->update([
            'payment_status' => 'paid',
            'paid_at' => now(),
        ]);

        // If order was pending payment, update status to processing
        if ($order->status === 'pending_payment') {
            $order->update(['status' => 'processing']);
        }

        // Create wallet transaction if user paid more than order total
        if ($payment->amount > $order->total_amount) {
            $excess = $payment->amount - $order->total_amount;
            $this->creditWallet($payment->user, $excess, 'Excess payment refund - Order ' . $order->order_number);
        }

        Log::info("Order {$order->order_number} payment completed", [
            'payment_id' => $payment->id,
            'amount' => $payment->amount,
        ]);
    }

    /**
     * Complete wallet top-up
     */
    private function completeWalletTopup(Payment $payment): void
    {
        $this->creditWallet(
            $payment->user,
            $payment->amount,
            'Wallet top-up via Paystack'
        );

        Log::info("Wallet top-up completed for user {$payment->user_id}", [
            'payment_id' => $payment->id,
            'amount' => $payment->amount,
        ]);
    }

    /**
     * Credit user wallet
     */
    private function creditWallet(User $user, float $amount, string $description): void
    {
        $wallet = Wallet::firstOrCreate(
            ['user_id' => $user->id],
            ['balance' => 0]
        );

        $wallet->increment('balance', $amount);

        WalletTransaction::create([
            'wallet_id' => $wallet->id,
            'type' => 'credit',
            'amount' => $amount,
            'balance_after' => $wallet->balance,
            'description' => $description,
            'status' => 'completed',
        ]);
    }

    /**
     * Process refund
     */
    public function processRefund(Payment $payment, ?float $amount = null): array
    {
        try {
            $refundAmount = $amount ?? $payment->amount;

            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->secretKey,
                'Content-Type' => 'application/json',
            ])->post($this->baseUrl . '/refund', [
                'transaction' => $payment->reference,
                'amount' => $refundAmount * 100, // Convert to kobo
            ]);

            $result = $response->json();

            if ($result['status'] ?? false) {
                // Create refund payment record
                $refund = Payment::create([
                    'reference' => $this->generateReference('RFD'),
                    'user_id' => $payment->user_id,
                    'order_id' => $payment->order_id,
                    'amount' => -$refundAmount, // Negative for refund
                    'currency' => $payment->currency,
                    'payment_method' => 'paystack_refund',
                    'status' => 'success',
                    'paid_at' => now(),
                    'metadata' => [
                        'original_payment_id' => $payment->id,
                        'refund_reason' => $result['data']['status'] ?? 'Refund processed',
                    ],
                ]);

                return [
                    'success' => true,
                    'refund_id' => $refund->id,
                    'message' => 'Refund processed successfully',
                ];
            }

            return [
                'success' => false,
                'message' => $result['message'] ?? 'Refund processing failed',
            ];
        } catch (\Exception $e) {
            Log::error('Paystack refund error: ' . $e->getMessage());
            return [
                'success' => false,
                'message' => 'Refund processing failed. Please try again.',
            ];
        }
    }

    /**
     * Generate unique payment reference
     */
    private function generateReference(string $prefix = 'PAY'): string
    {
        return $prefix . '-' . strtoupper(Str::random(8)) . '-' . time();
    }

    /**
     * Get payment statistics
     */
    public function getPaymentStatistics(?int $userId = null): array
    {
        $query = Payment::query();

        if ($userId) {
            $query->where('user_id', $userId);
        }

        return [
            'total_payments' => $query->count(),
            'successful_payments' => $query->where('status', 'success')->count(),
            'failed_payments' => $query->where('status', 'failed')->count(),
            'pending_payments' => $query->where('status', 'pending')->count(),
            'total_amount' => $query->where('status', 'success')->sum('amount'),
            'total_fees' => $query->where('status', 'success')->sum('fees'),
        ];
    }
}
