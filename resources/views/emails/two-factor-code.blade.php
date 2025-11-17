@extends('emails.layout')

@section('content')
    <h2>Two-Factor Authentication 🔒</h2>

    <p>Hello {{ $user->first_name }},</p>
    
    <p>Your two-factor authentication code is:</p>
    
    <div class="code-box">
        <div class="code">{{ $code }}</div>
        <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">Enter this code to complete your login</p>
    </div>
    
    <div class="danger-box">
        <p><strong>🔒 Security Notice:</strong></p>
        <p>This code will expire at <strong>{{ $expiresAt }}</strong>. Never share this code with anyone. {{ config('app.name') }} staff will never ask you for this code.</p>
    </div>
    
    <div class="divider"></div>
    
    <p>If you didn't attempt to log in, please change your password immediately and contact our support team.</p>
    
    <p>
        Best regards,<br>
        <strong>The {{ config('app.name') }} Team</strong>
    </p>
@endsection
