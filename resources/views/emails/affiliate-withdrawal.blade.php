@extends('emails.layout')

@section('content')
    <h2>Withdrawal Request {{ ucfirst($withdrawal->status) }}</h2>

    <p>Hi {{ $withdrawal->affiliate->user->first_name }},</p>

    @if($withdrawal->status === 'approved')
        <div class="success-box">
            <p><strong>Great news! Your withdrawal request has been approved.</strong></p>
            <p>Your funds will be transferred to your account within 1-3 business days.</p>
        </div>

        <div class="info-box">
            <p><strong>Withdrawal ID:</strong> {{ $withdrawal->id }}</p>
            <p><strong>Amount:</strong> ₦{{ number_format($withdrawal->amount, 2) }}</p>
            <p><strong>Payment Method:</strong> {{ ucfirst($withdrawal->payment_method) }}</p>
            <p><strong>Account Details:</strong> {{ $withdrawal->account_details }}</p>
            <p><strong>Status:</strong> Approved</p>
            <p><strong>Approved Date:</strong> {{ $withdrawal->updated_at->format('F d, Y \a\t h:i A') }}</p>
        </div>

        <p>
            The payment will be processed shortly. You will receive a confirmation once the transfer is complete.
        </p>

    @elseif($withdrawal->status === 'rejected')
        <div class="danger-box">
            <p><strong>Your withdrawal request has been rejected.</strong></p>
            @if($withdrawal->admin_notes)
            <p><strong>Reason:</strong> {{ $withdrawal->admin_notes }}</p>
            @endif
        </div>

        <div class="info-box">
            <p><strong>Withdrawal ID:</strong> {{ $withdrawal->id }}</p>
            <p><strong>Amount:</strong> ₦{{ number_format($withdrawal->amount, 2) }}</p>
            <p><strong>Request Date:</strong> {{ $withdrawal->created_at->format('F d, Y \a\t h:i A') }}</p>
            <p><strong>Status:</strong> Rejected</p>
        </div>

        <p>
            The requested amount has been returned to your available balance.
            If you have questions about this rejection, please contact our support team.
        </p>

    @elseif($withdrawal->status === 'completed')
        <div class="success-box">
            <p><strong>Your withdrawal has been completed successfully!</strong></p>
            <p>The funds have been transferred to your account.</p>
        </div>

        <div class="info-box">
            <p><strong>Withdrawal ID:</strong> {{ $withdrawal->id }}</p>
            <p><strong>Amount:</strong> ₦{{ number_format($withdrawal->amount, 2) }}</p>
            <p><strong>Payment Method:</strong> {{ ucfirst($withdrawal->payment_method) }}</p>
            <p><strong>Completed Date:</strong> {{ $withdrawal->updated_at->format('F d, Y \a\t h:i A') }}</p>
            @if($withdrawal->transaction_reference)
            <p><strong>Transaction Reference:</strong> {{ $withdrawal->transaction_reference }}</p>
            @endif
        </div>

        <p>
            Please check your account to confirm receipt of the funds.
            If you don't receive the payment within 3 business days, please contact support.
        </p>

    @else
        <div class="alert-box">
            <p><strong>Your withdrawal request is being processed.</strong></p>
            <p>We'll notify you once it has been reviewed and approved.</p>
        </div>

        <div class="info-box">
            <p><strong>Withdrawal ID:</strong> {{ $withdrawal->id }}</p>
            <p><strong>Amount:</strong> ₦{{ number_format($withdrawal->amount, 2) }}</p>
            <p><strong>Request Date:</strong> {{ $withdrawal->created_at->format('F d, Y \a\t h:i A') }}</p>
            <p><strong>Status:</strong> {{ ucfirst($withdrawal->status) }}</p>
        </div>
    @endif

    <a href="{{ config('app.url') }}/affiliate/withdrawals" class="button">View Withdrawal History</a>

    <div class="divider"></div>

    <p>
        If you have any questions about your withdrawal, please don't hesitate to contact our support team.
    </p>

    <p>
        Best regards,<br>
        <strong>The {{ config('app.name') }} Affiliate Team</strong>
    </p>
@endsection
