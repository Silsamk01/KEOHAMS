<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Models\PaymentTransaction;
use App\Models\Order;
use App\Models\Quotation;
use App\Models\ActivityLog;
use App\Services\PaymentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PaymentController extends Controller
{
    private PaymentService $paymentService;

    public function __construct(PaymentService $paymentService)
    {
        $this->paymentService = $paymentService;
    }
    /**
     * Initialize payment
     */
    public function initialize(Request $request)
    {
        $validated = $request->validate([
            'type' => 'required|in:ORDER,QUOTATION,WALLET_TOPUP',
            'order_id' => 'required_if:type,ORDER|exists:orders,id',
            'quotation_id' => 'required_if:type,QUOTATION|exists:quotations,id',
            'amount' => 'required_if:type,WALLET_TOPUP|numeric|min:0',
            'currency' => 'nullable|string|in:NGN,USD,GHS',
            'callback_url' => 'nullable|url',
        ]);

        $user = $request->user();
        $amount = 0;
        $metadata = ['type' => $validated['type']];

        // Determine amount
        if ($validated['type'] === 'ORDER') {
            $order = Order::findOrFail($validated['order_id']);
            
            if ($order->user_id !== $user->id) {
                return response()->json(['message' => 'Unauthorized.'], 403);
            }
            
            if ($order->is_paid) {
                return response()->json(['message' => 'Order already paid.'], 400);
            }

            $amount = $order->total_amount;
            $metadata['order_id'] = $order->id;
            $metadata['order_number'] = $order->order_number;

        } elseif ($validated['type'] === 'QUOTATION') {
            $quotation = Quotation::findOrFail($validated['quotation_id']);
            
            if ($quotation->user_id !== $user->id) {
                return response()->json(['message' => 'Unauthorized.'], 403);
            }
            
            if ($quotation->is_paid) {
                return response()->json(['message' => 'Quotation already paid.'], 400);
            }

            $amount = $quotation->total_amount;
            $metadata['quotation_id'] = $quotation->id;
            $metadata['quotation_reference'] = $quotation->quotation_reference;

        } elseif ($validated['type'] === 'WALLET_TOPUP') {
            $amount = $validated['amount'];
        }

        // Create payment transaction
        $transaction = PaymentTransaction::create([
            'user_id' => $user->id,
            'transaction_reference' => PaymentTransaction::generateReference(),
            'amount' => $amount,
            'currency' => $validated['currency'] ?? 'NGN',
            'payment_method' => 'PAYSTACK',
            'status' => 'PENDING',
            'order_id' => $validated['order_id'] ?? null,
            'quotation_id' => $validated['quotation_id'] ?? null,
            'metadata' => $metadata,
        ]);

        // Initialize Paystack payment
        try {
            $paystackSecretKey = config('services.paystack.secret_key');
            
            $response = Http::withHeaders([
                'Authorization' => "Bearer {$paystackSecretKey}",
                'Content-Type' => 'application/json',
            ])->post('https://api.paystack.co/transaction/initialize', [
                'email' => $user->email,
                'amount' => $amount * 100, // Convert to kobo
                'currency' => $validated['currency'] ?? 'NGN',
                'reference' => $transaction->transaction_reference,
                'callback_url' => $validated['callback_url'] ?? config('app.url') . '/payment/callback',
                'metadata' => array_merge($metadata, [
                    'user_id' => $user->id,
                    'user_email' => $user->email,
                    'user_name' => $user->first_name . ' ' . $user->last_name,
                ]),
            ]);

            if (!$response->successful()) {
                throw new \Exception('Payment initialization failed: ' . $response->body());
            }

            $data = $response->json();

            if (!$data['status']) {
                throw new \Exception('Paystack error: ' . $data['message']);
            }

            $transaction->update([
                'paystack_reference' => $data['data']['reference'],
                'paystack_access_code' => $data['data']['access_code'],
            ]);

            ActivityLog::log('PAYMENT_INITIALIZED', $user->id, 'Payment initialized', [
                'transaction_id' => $transaction->id,
                'reference' => $transaction->transaction_reference,
                'amount' => $amount,
            ]);

            return response()->json([
                'message' => 'Payment initialized successfully.',
                'authorization_url' => $data['data']['authorization_url'],
                'access_code' => $data['data']['access_code'],
                'reference' => $transaction->transaction_reference,
            ]);

        } catch (\Exception $e) {
            Log::error('Payment initialization error: ' . $e->getMessage());
            
            $transaction->markAsFailed('Initialization failed: ' . $e->getMessage());

            return response()->json([
                'message' => 'Payment initialization failed.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Verify payment
     */
    public function verify(Request $request)
    {
        $validated = $request->validate([
            'reference' => 'required|string',
        ]);

        $transaction = PaymentTransaction::where('transaction_reference', $validated['reference'])
            ->orWhere('paystack_reference', $validated['reference'])
            ->firstOrFail();

        if ($transaction->status === 'SUCCESS') {
            return response()->json([
                'message' => 'Payment already verified.',
                'transaction' => $transaction
            ]);
        }

        try {
            $paystackSecretKey = config('services.paystack.secret_key');
            
            $response = Http::withHeaders([
                'Authorization' => "Bearer {$paystackSecretKey}",
            ])->get("https://api.paystack.co/transaction/verify/{$validated['reference']}");

            if (!$response->successful()) {
                throw new \Exception('Payment verification failed: ' . $response->body());
            }

            $data = $response->json();

            if (!$data['status']) {
                throw new \Exception('Paystack error: ' . $data['message']);
            }

            $paystackData = $data['data'];

            if ($paystackData['status'] === 'success') {
                $transaction->markAsSuccess($paystackData);

                // Update related order or quotation
                if ($transaction->order_id) {
                    $transaction->order->markAsPaid($transaction->id);
                }
                if ($transaction->quotation_id) {
                    $transaction->quotation->markAsPaid($transaction->id);
                }

                ActivityLog::log('PAYMENT_VERIFIED', $transaction->user_id, 'Payment verified', [
                    'transaction_id' => $transaction->id,
                    'reference' => $transaction->transaction_reference,
                    'amount' => $transaction->amount,
                ]);

                return response()->json([
                    'message' => 'Payment verified successfully.',
                    'transaction' => $transaction
                ]);

            } else {
                $transaction->markAsFailed('Payment status: ' . $paystackData['status']);

                return response()->json([
                    'message' => 'Payment verification failed.',
                    'transaction' => $transaction
                ], 400);
            }

        } catch (\Exception $e) {
            Log::error('Payment verification error: ' . $e->getMessage());
            
            return response()->json([
                'message' => 'Payment verification failed.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Handle Paystack webhook
     */
    public function webhook(Request $request)
    {
        // Verify webhook signature
        $signature = $request->header('X-Paystack-Signature');
        $paystackSecretKey = config('services.paystack.secret_key');
        
        $computedSignature = hash_hmac('sha512', $request->getContent(), $paystackSecretKey);

        if ($signature !== $computedSignature) {
            Log::warning('Invalid Paystack webhook signature');
            return response()->json(['message' => 'Invalid signature'], 400);
        }

        $event = $request->input('event');
        $data = $request->input('data');

        try {
            switch ($event) {
                case 'charge.success':
                    $this->handleChargeSuccess($data);
                    break;
                
                case 'charge.failed':
                    $this->handleChargeFailed($data);
                    break;
                
                default:
                    Log::info("Unhandled webhook event: {$event}");
            }

            return response()->json(['message' => 'Webhook processed']);

        } catch (\Exception $e) {
            Log::error('Webhook processing error: ' . $e->getMessage());
            return response()->json(['message' => 'Webhook processing failed'], 500);
        }
    }

    /**
     * Handle successful charge webhook
     */
    private function handleChargeSuccess($data)
    {
        $transaction = PaymentTransaction::where('paystack_reference', $data['reference'])->first();

        if (!$transaction) {
            Log::warning('Transaction not found for reference: ' . $data['reference']);
            return;
        }

        if ($transaction->status === 'SUCCESS') {
            return; // Already processed
        }

        $transaction->markAsSuccess($data);

        // Update related order or quotation
        if ($transaction->order_id) {
            $transaction->order->markAsPaid($transaction->id);
        }
        if ($transaction->quotation_id) {
            $transaction->quotation->markAsPaid($transaction->id);
        }

        ActivityLog::log('PAYMENT_WEBHOOK_SUCCESS', $transaction->user_id, 'Payment webhook success', [
            'transaction_id' => $transaction->id,
            'reference' => $transaction->transaction_reference,
        ]);
    }

    /**
     * Handle failed charge webhook
     */
    private function handleChargeFailed($data)
    {
        $transaction = PaymentTransaction::where('paystack_reference', $data['reference'])->first();

        if (!$transaction) {
            Log::warning('Transaction not found for reference: ' . $data['reference']);
            return;
        }

        $transaction->markAsFailed($data['gateway_response'] ?? 'Payment failed');

        ActivityLog::log('PAYMENT_WEBHOOK_FAILED', $transaction->user_id, 'Payment webhook failed', [
            'transaction_id' => $transaction->id,
            'reference' => $transaction->transaction_reference,
        ]);
    }

    /**
     * Get user's payment history
     */
    public function history(Request $request)
    {
        $transactions = PaymentTransaction::with(['order', 'quotation'])
            ->byUser($request->user()->id)
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($transactions);
    }

    /**
     * Get all transactions (Admin only)
     */
    public function adminIndex(Request $request)
    {
        $query = PaymentTransaction::with(['user', 'order', 'quotation']);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('transaction_reference', 'LIKE', "%{$search}%")
                  ->orWhere('paystack_reference', 'LIKE', "%{$search}%")
                  ->orWhereHas('user', function($q2) use ($search) {
                      $q2->where('email', 'LIKE', "%{$search}%");
                  });
            });
        }

        $transactions = $query->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($transactions);
    }

    /**
     * Initialize order payment using PaymentService
     * POST /api/v1/payments/initialize-order
     */
    public function initializeOrderPayment(Request $request)
    {
        $request->validate([
            'order_id' => 'required|exists:orders,id',
        ]);

        $user = $request->user();
        $order = Order::findOrFail($request->order_id);

        // Verify order belongs to user
        if ($order->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access to order',
            ], 403);
        }

        // Check if order is already paid
        if ($order->payment_status === 'paid') {
            return response()->json([
                'success' => false,
                'message' => 'Order is already paid',
            ], 400);
        }

        $result = $this->paymentService->processOrderPayment($order, $user);

        if (!$result['success']) {
            return response()->json($result, 400);
        }

        return response()->json([
            'success' => true,
            'message' => 'Payment initialized successfully',
            'data' => [
                'payment_id' => $result['payment_id'],
                'authorization_url' => $result['authorization_url'],
                'reference' => $result['reference'],
            ],
        ]);
    }

    /**
     * Initialize wallet top-up using PaymentService
     * POST /api/v1/payments/initialize-wallet
     */
    public function initializeWalletTopup(Request $request)
    {
        $request->validate([
            'amount' => 'required|numeric|min:100|max:1000000',
        ]);

        $user = $request->user();
        $amount = (float) $request->amount;

        $result = $this->paymentService->processWalletTopup($amount, $user);

        if (!$result['success']) {
            return response()->json($result, 400);
        }

        return response()->json([
            'success' => true,
            'message' => 'Wallet top-up initialized successfully',
            'data' => [
                'payment_id' => $result['payment_id'],
                'authorization_url' => $result['authorization_url'],
                'reference' => $result['reference'],
            ],
        ]);
    }

    /**
     * Verify payment using PaymentService
     * GET /api/v1/payments/verify-payment/{reference}
     */
    public function verifyPaymentNew(Request $request, string $reference)
    {
        $result = $this->paymentService->handleSuccessfulPayment($reference);

        if (!$result['success']) {
            return response()->json($result, 400);
        }

        $payment = $result['payment'];

        // Verify user owns this payment
        if ($payment->user_id !== $request->user()->id) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access to payment',
            ], 403);
        }

        return response()->json([
            'success' => true,
            'message' => $result['message'],
            'data' => [
                'payment' => [
                    'id' => $payment->id,
                    'reference' => $payment->reference,
                    'amount' => $payment->amount,
                    'currency' => $payment->currency,
                    'status' => $payment->status,
                    'paid_at' => $payment->paid_at,
                    'order_id' => $payment->order_id,
                ],
            ],
        ]);
    }

    /**
     * Get payment statistics
     * GET /api/v1/payments/statistics
     */
    public function getPaymentStatistics(Request $request)
    {
        $user = $request->user();
        $statistics = $this->paymentService->getPaymentStatistics($user->id);

        return response()->json([
            'success' => true,
            'data' => $statistics,
        ]);
    }

    /**
     * Admin: Process refund
     * POST /api/v1/admin/payments/{id}/refund
     */
    public function adminProcessRefund(Request $request, int $id)
    {
        $request->validate([
            'amount' => 'nullable|numeric|min:1',
            'reason' => 'nullable|string|max:500',
        ]);

        $payment = Payment::findOrFail($id);

        if ($payment->status !== 'success') {
            return response()->json([
                'success' => false,
                'message' => 'Can only refund successful payments',
            ], 400);
        }

        $amount = $request->amount ? (float) $request->amount : null;
        $result = $this->paymentService->processRefund($payment, $amount);

        if (!$result['success']) {
            return response()->json($result, 400);
        }

        Log::info('Refund processed by admin', [
            'admin_id' => $request->user()->id,
            'payment_id' => $payment->id,
            'amount' => $amount ?? $payment->amount,
            'reason' => $request->reason,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Refund processed successfully',
            'data' => [
                'refund_id' => $result['refund_id'],
            ],
        ]);
    }

    /**
     * Admin: Get payment statistics
     * GET /api/v1/admin/payments/statistics
     */
    public function adminGetStatistics(Request $request)
    {
        $statistics = $this->paymentService->getPaymentStatistics();

        // Additional admin statistics
        $statistics['today_payments'] = Payment::whereDate('created_at', today())
            ->where('status', 'success')
            ->sum('amount');

        $statistics['this_week_payments'] = Payment::whereBetween('created_at', [
            now()->startOfWeek(),
            now()->endOfWeek(),
        ])->where('status', 'success')->sum('amount');

        $statistics['this_month_payments'] = Payment::whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->where('status', 'success')
            ->sum('amount');

        return response()->json([
            'success' => true,
            'data' => $statistics,
        ]);
    }
}
