@extends('emails.layout')

@section('content')
    <h2>Verify Your Email Address 📧</h2>

    <p>Hello {{ $user->first_name }},</p>
    
    <p>Thank you for registering with {{ config('app.name') }}! Please verify your email address by clicking the button below:</p>
    
    <div style="text-align: center;">
        <a href="{{ $verificationUrl }}" class="button">Verify Email Address</a>
    </div>
    
    <div class="alert-box">
        <p><strong>Important:</strong> This verification link will expire in 24 hours.</p>
    </div>

    <p>If the button doesn't work, copy and paste this link into your browser:</p>
    <div class="info-box">
        <p style="word-break: break-all; color: #667eea;">{{ $verificationUrl }}</p>
    </div>
    
    <div class="divider"></div>
    
    <p>If you did not create an account, no further action is required and you can safely ignore this email.</p>
    
    <p>
        Best regards,<br>
        <strong>The {{ config('app.name') }} Team</strong>
    </p>
@endsection
