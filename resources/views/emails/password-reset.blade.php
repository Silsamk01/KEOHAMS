<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
        }
        .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
        }
        .button {
            display: inline-block;
            padding: 15px 30px;
            background: #f5576c;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
        }
        .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            margin-top: 20px;
            color: #666;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>KEOHAMS</h1>
        <p>Password Reset Request</p>
    </div>
    <div class="content">
        <p>Hello {{ $user->first_name }},</p>
        
        <p>We received a request to reset your password for your KEOHAMS account.</p>
        
        <center>
            <a href="{{ $resetUrl }}" class="button">Reset Password</a>
        </center>
        
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #f5576c;">{{ $resetUrl }}</p>
        
        <div class="warning">
            <strong>⚠️ Security Notice:</strong>
            <p style="margin: 5px 0 0 0;">This password reset link will expire at {{ $expiresAt }}. If you didn't request this reset, please ignore this email or contact our support team immediately.</p>
        </div>
        
        <p>Best regards,<br>The KEOHAMS Team</p>
    </div>
    <div class="footer">
        <p>&copy; {{ date('Y') }} KEOHAMS. All rights reserved.</p>
        <p>This is an automated email. Please do not reply to this message.</p>
    </div>
</body>
</html>
