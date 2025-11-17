<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Affiliate Account Approved</title>
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
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
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
        .success-box {
            background: #d4edda;
            border-left: 4px solid #28a745;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
        }
        .referral-box {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            border: 2px solid #38ef7d;
        }
        .referral-code {
            font-size: 24px;
            font-weight: bold;
            color: #11998e;
            font-family: monospace;
            text-align: center;
            margin: 15px 0;
        }
        .link-box {
            background: #f9f9f9;
            padding: 15px;
            border-radius: 5px;
            word-break: break-all;
            color: #11998e;
            font-size: 14px;
        }
        .button {
            display: inline-block;
            padding: 15px 30px;
            background: #11998e;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
        }
        .tips {
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
        <p>🎉 Congratulations! Your Affiliate Account is Approved!</p>
    </div>
    <div class="content">
        <p>Hello {{ $affiliate->first_name }},</p>
        
        <div class="success-box">
            <h3 style="margin-top: 0;">✅ Account Approved</h3>
            <p style="margin: 0;">Your KEOHAMS affiliate account has been approved and is now active! You can start earning commissions right away.</p>
            <p style="margin: 10px 0 0 0;"><strong>Approved on:</strong> {{ $approvedAt }}</p>
        </div>
        
        <div class="referral-box">
            <h3 style="margin-top: 0; text-align: center;">Your Referral Information</h3>
            <div class="referral-code">{{ $referralCode }}</div>
            
            <p style="margin: 20px 0 5px 0;"><strong>Your Referral Link:</strong></p>
            <div class="link-box">{{ $referralLink }}</div>
            
            <p style="margin: 15px 0 0 0; text-align: center; font-size: 14px; color: #666;">Share this link to start earning commissions</p>
        </div>
        
        <center>
            <a href="{{ $dashboardUrl }}" class="button">Go to Your Dashboard</a>
        </center>
        
        <div class="tips">
            <h3 style="margin-top: 0;">💡 Tips to Get Started</h3>
            <ol>
                <li><strong>Share Your Link:</strong> Post your referral link on social media, blogs, or send it to friends and family</li>
                <li><strong>Track Your Performance:</strong> Use your dashboard to monitor clicks, sales, and commissions</li>
                <li><strong>Grow Your Network:</strong> Build a downline to earn from multiple levels</li>
                <li><strong>Optimize Your Strategy:</strong> Focus on high-value products and targeted audiences</li>
                <li><strong>Request Payouts:</strong> Withdraw your earnings once you reach the minimum threshold</li>
            </ol>
        </div>
        
        <p><strong>📊 Commission Structure:</strong></p>
        <ul>
            <li>Direct referral sales: Earn percentage on every purchase</li>
            <li>Level 2 commissions: Earn from your referrals' sales</li>
            <li>Level 3 commissions: Earn from their referrals' sales</li>
            <li>Bonus incentives for top performers</li>
        </ul>
        
        <p><strong>💳 Payment Information:</strong></p>
        <ul>
            <li>Minimum withdrawal: Check dashboard for current threshold</li>
            <li>Payment frequency: Monthly or on-demand (above minimum)</li>
            <li>Payment methods: Bank transfer, mobile money</li>
        </ul>
        
        <p>Start sharing your referral link today and watch your commissions grow!</p>
        
        <p>Best regards,<br>The KEOHAMS Affiliate Team</p>
    </div>
    <div class="footer">
        <p>&copy; {{ date('Y') }} KEOHAMS. All rights reserved.</p>
        <p>This is an automated email. Please do not reply to this message.</p>
    </div>
</body>
</html>
