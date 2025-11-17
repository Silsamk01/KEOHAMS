<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to KEOHAMS Affiliate Program</title>
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
        .referral-box {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            border: 2px dashed #f5576c;
        }
        .referral-code {
            font-size: 24px;
            font-weight: bold;
            color: #f5576c;
            font-family: monospace;
            text-align: center;
            margin: 15px 0;
        }
        .link-box {
            background: #f9f9f9;
            padding: 15px;
            border-radius: 5px;
            word-break: break-all;
            color: #f5576c;
            font-size: 14px;
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
        .benefits {
            background: white;
            padding: 20px;
            border-radius: 10px;
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
        <p>Welcome to the Affiliate Program! 🎉</p>
    </div>
    <div class="content">
        <p>Hello {{ $affiliate->first_name }},</p>
        
        <p>Thank you for joining the KEOHAMS Affiliate Program! Your application has been received and is currently under review.</p>
        
        <div class="referral-box">
            <h3 style="margin-top: 0; text-align: center;">Your Referral Code</h3>
            <div class="referral-code">{{ $referralCode }}</div>
            
            <p style="margin: 20px 0 5px 0;"><strong>Your Referral Link:</strong></p>
            <div class="link-box">{{ $referralLink }}</div>
        </div>
        
        <p><strong>⏳ Application Status:</strong> Pending Approval</p>
        <p>Your application will be reviewed by our team within 1-3 business days. You'll receive an email once your account is approved.</p>
        
        <div class="benefits">
            <h3 style="margin-top: 0;">💰 Affiliate Benefits</h3>
            <ul>
                <li>Earn competitive commissions on every sale</li>
                <li>Multi-level marketing (MLM) earning potential</li>
                <li>Real-time sales tracking dashboard</li>
                <li>Monthly commission payouts</li>
                <li>Dedicated affiliate support</li>
                <li>Marketing materials and resources</li>
            </ul>
        </div>
        
        <center>
            <a href="{{ $dashboardUrl }}" class="button">View Your Dashboard</a>
        </center>
        
        <p><strong>What's Next?</strong></p>
        <ol>
            <li>Wait for account approval (1-3 business days)</li>
            <li>Once approved, start sharing your referral link</li>
            <li>Earn commissions on every successful referral</li>
            <li>Track your earnings in real-time</li>
            <li>Request withdrawals when you reach the minimum threshold</li>
        </ol>
        
        <p>If you have any questions, feel free to contact our affiliate support team.</p>
        
        <p>Best regards,<br>The KEOHAMS Affiliate Team</p>
    </div>
    <div class="footer">
        <p>&copy; {{ date('Y') }} KEOHAMS. All rights reserved.</p>
        <p>This is an automated email. Please do not reply to this message.</p>
    </div>
</body>
</html>
