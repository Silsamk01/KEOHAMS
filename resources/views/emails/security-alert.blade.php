@extends('emails.layout')

@section('content')
    <h2>🚨 Security Alert</h2>

    <p>Hi {{ $user->first_name }},</p>

    <div class="danger-box">
        <p style="font-size: 16px; margin: 0;">
            <strong>{{ $alertType }}</strong>
        </p>
    </div>

    @if($alertType === 'Multiple Failed Login Attempts')
        <p>
            We detected multiple failed login attempts on your account. If this wasn't you,
            your account may be at risk.
        </p>

        <div class="info-box">
            <p><strong>Failed Attempts:</strong> {{ $details['attempts'] ?? 'Multiple' }}</p>
            <p><strong>IP Address:</strong> {{ $details['ip'] ?? 'Unknown' }}</p>
            <p><strong>Location:</strong> {{ $details['location'] ?? 'Unknown' }}</p>
            <p><strong>Time:</strong> {{ $details['time'] ?? now()->format('F d, Y \a\t h:i A') }}</p>
            @if(isset($details['user_agent']))
            <p><strong>Device:</strong> {{ $details['user_agent'] }}</p>
            @endif
        </div>

        <p><strong>What should you do?</strong></p>
        <ul style="margin-left: 20px; margin-bottom: 20px;">
            <li style="margin-bottom: 8px;">Change your password immediately if you suspect unauthorized access</li>
            <li style="margin-bottom: 8px;">Enable two-factor authentication for extra security</li>
            <li style="margin-bottom: 8px;">Review your recent account activity</li>
            <li style="margin-bottom: 8px;">Contact support if you notice any suspicious activity</li>
        </ul>

    @elseif($alertType === 'New Login from Unfamiliar Device')
        <p>
            We noticed a login to your account from a device we don't recognize.
            If this was you, you can safely ignore this email.
        </p>

        <div class="info-box">
            <p><strong>IP Address:</strong> {{ $details['ip'] ?? 'Unknown' }}</p>
            <p><strong>Location:</strong> {{ $details['location'] ?? 'Unknown' }}</p>
            <p><strong>Device:</strong> {{ $details['user_agent'] ?? 'Unknown' }}</p>
            <p><strong>Time:</strong> {{ $details['time'] ?? now()->format('F d, Y \a\t h:i A') }}</p>
        </div>

        <p>
            <strong>If this wasn't you:</strong> Change your password immediately and
            contact our support team.
        </p>

    @elseif($alertType === 'Password Changed')
        <p>
            The password for your account was recently changed. If you made this change,
            no further action is needed.
        </p>

        <div class="info-box">
            <p><strong>Changed At:</strong> {{ $details['time'] ?? now()->format('F d, Y \a\t h:i A') }}</p>
            <p><strong>IP Address:</strong> {{ $details['ip'] ?? 'Unknown' }}</p>
        </div>

        <p>
            <strong>If you didn't make this change:</strong> Your account may have been compromised.
            Please contact our support team immediately.
        </p>

    @elseif($alertType === 'Suspicious Activity Detected')
        <p>
            We detected unusual activity on your account that may indicate a security threat.
        </p>

        <div class="info-box">
            <p><strong>Activity Type:</strong> {{ $details['activity_type'] ?? 'Suspicious activity' }}</p>
            <p><strong>Detected At:</strong> {{ $details['time'] ?? now()->format('F d, Y \a\t h:i A') }}</p>
            <p><strong>IP Address:</strong> {{ $details['ip'] ?? 'Unknown' }}</p>
            @if(isset($details['description']))
            <p><strong>Details:</strong> {{ $details['description'] }}</p>
            @endif
        </div>

        <p>
            We've taken precautionary measures to protect your account. Please review your
            recent activity and contact support if anything seems unusual.
        </p>

    @elseif($alertType === 'Account Locked')
        <p>
            Your account has been temporarily locked due to multiple failed login attempts
            or suspicious activity.
        </p>

        <div class="alert-box">
            <p>
                <strong>Your account will be automatically unlocked in {{ $details['lockout_minutes'] ?? 30 }} minutes.</strong>
            </p>
        </div>

        <div class="info-box">
            <p><strong>Locked At:</strong> {{ $details['time'] ?? now()->format('F d, Y \a\t h:i A') }}</p>
            <p><strong>Reason:</strong> {{ $details['reason'] ?? 'Multiple failed login attempts' }}</p>
        </div>

        <p>
            If you need immediate access or believe this was an error, please contact our support team.
        </p>

    @else
        <p>{{ $details['message'] ?? 'A security event occurred on your account.' }}</p>

        @if(isset($details) && is_array($details))
        <div class="info-box">
            @foreach($details as $key => $value)
                @if(!in_array($key, ['message']))
                <p><strong>{{ ucfirst(str_replace('_', ' ', $key)) }}:</strong> {{ $value }}</p>
                @endif
            @endforeach
        </div>
        @endif
    @endif

    <a href="{{ config('app.url') }}/settings/security" class="button">Review Security Settings</a>

    <div class="divider"></div>

    <p>
        <strong>Security Tips:</strong>
    </p>
    <ul style="margin-left: 20px; margin-bottom: 20px;">
        <li style="margin-bottom: 8px;">Use a strong, unique password</li>
        <li style="margin-bottom: 8px;">Enable two-factor authentication</li>
        <li style="margin-bottom: 8px;">Never share your password with anyone</li>
        <li style="margin-bottom: 8px;">Be cautious of phishing emails</li>
        <li style="margin-bottom: 8px;">Keep your contact information up to date</li>
    </ul>

    <p>
        If you have any concerns about your account security, please contact us immediately.
    </p>

    <p>
        Best regards,<br>
        <strong>The {{ config('app.name') }} Security Team</strong>
    </p>
@endsection
