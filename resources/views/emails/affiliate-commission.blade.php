@extends('emails.layout')

@section('content')
    <h2>Commission Earned! 💰</h2>

    <p>Hi {{ $affiliate->user->first_name }},</p>

    <p>
        Great news! You've earned a new commission from a successful referral.
        Keep up the excellent work promoting {{ config('app.name') }}!
    </p>

    <div class="success-box">
        <p style="font-size: 18px; margin: 0;">
            <strong>Commission Amount: ₦{{ number_format($commission->amount, 2) }}</strong>
        </p>
    </div>

    <div class="info-box">
        <p><strong>Commission ID:</strong> {{ $commission->id }}</p>
        <p><strong>Order Number:</strong> #{{ $commission->order->order_number }}</p>
        <p><strong>Order Total:</strong> ₦{{ number_format($commission->order->total_amount, 2) }}</p>
        <p><strong>Commission Rate:</strong> {{ $commission->commission_rate }}%</p>
        <p><strong>Earned Amount:</strong> ₦{{ number_format($commission->amount, 2) }}</p>
        <p><strong>Date:</strong> {{ $commission->created_at->format('F d, Y \a\t h:i A') }}</p>
        <p><strong>Status:</strong> {{ ucfirst($commission->status) }}</p>
    </div>

    <h3 style="margin-top: 30px; margin-bottom: 15px;">Your Affiliate Stats</h3>
    <div class="info-box">
        <p><strong>Total Referrals:</strong> {{ $affiliate->total_referrals ?? 0 }}</p>
        <p><strong>Total Earnings:</strong> ₦{{ number_format($affiliate->total_earnings ?? 0, 2) }}</p>
        <p><strong>Available Balance:</strong> ₦{{ number_format($affiliate->available_balance ?? 0, 2) }}</p>
        <p><strong>Pending Balance:</strong> ₦{{ number_format($affiliate->pending_balance ?? 0, 2) }}</p>
    </div>

    <div class="alert-box">
        <p>
            <strong>Note:</strong> This commission will be available for withdrawal after the order is confirmed delivered
            and the return period has passed (typically 14 days).
        </p>
    </div>

    <a href="{{ config('app.url') }}/affiliate/dashboard" class="button">View Affiliate Dashboard</a>

    <div class="divider"></div>

    <p>
        Keep sharing your unique referral link to earn more commissions!
        The more you refer, the more you earn.
    </p>

    <p>
        Best regards,<br>
        <strong>The {{ config('app.name') }} Affiliate Team</strong>
    </p>
@endsection
