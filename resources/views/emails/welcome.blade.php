@extends('emails.layout')

@section('content')
    <h2>Welcome to {{ config('app.name') }}! 🎉</h2>

    <p>Hi {{ $user->first_name }},</p>

    <p>
        Thank you for joining {{ config('app.name') }}! We're thrilled to have you as part of our community.
        Your account has been successfully created and you're now ready to explore everything we have to offer.
    </p>

    <div class="success-box">
        <p><strong>Your account is now active!</strong></p>
        <p>You can now browse our products, make purchases, and enjoy exclusive member benefits.</p>
    </div>

    <div class="info-box">
        <p><strong>Account Details:</strong></p>
        <p><strong>Name:</strong> {{ $user->first_name }} {{ $user->last_name }}</p>
        <p><strong>Email:</strong> {{ $user->email }}</p>
        <p><strong>Member Since:</strong> {{ $user->created_at->format('F d, Y') }}</p>
    </div>

    <p><strong>What's next?</strong></p>
    <ul style="margin-left: 20px; margin-bottom: 20px;">
        <li style="margin-bottom: 8px;">Complete your profile to personalize your experience</li>
        <li style="margin-bottom: 8px;">Browse our extensive product catalog</li>
        <li style="margin-bottom: 8px;">Set up your payment methods for faster checkout</li>
        <li style="margin-bottom: 8px;">Enable two-factor authentication for enhanced security</li>
    </ul>

    <a href="{{ config('app.url') }}/dashboard" class="button">Go to Dashboard</a>

    <div class="divider"></div>

    <p>If you have any questions or need assistance, our support team is here to help!</p>

    <p>
        Best regards,<br>
        <strong>The {{ config('app.name') }} Team</strong>
    </p>
@endsection
