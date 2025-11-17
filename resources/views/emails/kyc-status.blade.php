<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KYC Verification Update</title>
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
            background: {{ $status === 'APPROVED' ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' : 'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)' }};
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
        .status-box {
            background: {{ $status === 'APPROVED' ? '#d4edda' : '#f8d7da' }};
            border-left: 4px solid {{ $status === 'APPROVED' ? '#28a745' : '#dc3545' }};
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
        }
        .button {
            display: inline-block;
            padding: 15px 30px;
            background: {{ $status === 'APPROVED' ? '#28a745' : '#dc3545' }};
            color: white;
            text-decoration: none;
            border-radius: 5px;
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
        <p>KYC Verification Update</p>
    </div>
    <div class="content">
        <p>Hello {{ $user->first_name }},</p>
        
        @if($status === 'APPROVED')
            <div class="status-box">
                <h2 style="margin: 0 0 10px 0; color: #28a745;">✅ KYC Verification Approved</h2>
                <p style="margin: 0;">Congratulations! Your KYC verification has been successfully approved.</p>
            </div>
            
            <p>Your account has been upgraded to <strong>KYC Verified</strong> status. You now have access to:</p>
            
            <ul>
                <li>Higher transaction limits</li>
                <li>Wholesale pricing and bulk orders</li>
                <li>Priority customer support</li>
                <li>Business quotation requests</li>
                <li>Extended payment terms</li>
            </ul>
            
            <center>
                <a href="{{ $dashboardUrl }}" class="button">Go to Dashboard</a>
            </center>
            
        @elseif($status === 'REJECTED')
            <div class="status-box">
                <h2 style="margin: 0 0 10px 0; color: #dc3545;">❌ KYC Verification Not Approved</h2>
                <p style="margin: 0;">Unfortunately, we were unable to approve your KYC verification at this time.</p>
            </div>
            
            @if($rejectionReason)
                <p><strong>Reason:</strong></p>
                <p style="background: white; padding: 15px; border-radius: 5px;">{{ $rejectionReason }}</p>
            @endif
            
            <p>Please review the reason above and submit a new KYC verification with the required corrections.</p>
            
            <center>
                <a href="{{ $dashboardUrl }}" class="button">Submit New KYC</a>
            </center>
            
        @else
            <div class="status-box">
                <h2 style="margin: 0 0 10px 0; color: #ffc107;">⏳ KYC Verification In Review</h2>
                <p style="margin: 0;">Your KYC verification is currently being reviewed by our team.</p>
            </div>
            
            <p>We will notify you once the review is complete. This typically takes 1-3 business days.</p>
        @endif
        
        <p><strong>Submission Date:</strong> {{ $submittedAt }}</p>
        @if($reviewedAt)
            <p><strong>Reviewed Date:</strong> {{ $reviewedAt }}</p>
        @endif
        
        <p>If you have any questions, please contact our support team.</p>
        
        <p>Best regards,<br>The KEOHAMS Team</p>
    </div>
    <div class="footer">
        <p>&copy; {{ date('Y') }} KEOHAMS. All rights reserved.</p>
        <p>This is an automated email. Please do not reply to this message.</p>
    </div>
</body>
</html>
