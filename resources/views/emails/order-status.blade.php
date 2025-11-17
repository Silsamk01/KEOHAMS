<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Status Update</title>
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
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            border-left: 4px solid #667eea;
        }
        .tracking-box {
            background: #e3f2fd;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            text-align: center;
        }
        .tracking-number {
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
            font-family: monospace;
            margin: 10px 0;
        }
        .button {
            display: inline-block;
            padding: 15px 30px;
            background: #667eea;
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
        <p>Order Status Update</p>
        <h2 style="margin: 0;">Order #{{ $order->order_number }}</h2>
    </div>
    <div class="content">
        <p>Hello {{ $user->first_name }},</p>
        
        <div class="status-box">
            <h3 style="margin-top: 0;">
                @if($newStatus === 'PROCESSING')
                    🔄 Your order is being processed
                @elseif($newStatus === 'SHIPPED')
                    📦 Your order has been shipped
                @elseif($newStatus === 'DELIVERED')
                    ✅ Your order has been delivered
                @elseif($newStatus === 'CANCELLED')
                    ❌ Your order has been cancelled
                @endif
            </h3>
            
            <p><strong>Order Number:</strong> {{ $order->order_number }}</p>
            <p><strong>New Status:</strong> {{ $newStatus }}</p>
            <p><strong>Updated At:</strong> {{ now()->format('M d, Y h:i A') }}</p>
        </div>
        
        @if($newStatus === 'SHIPPED' && $trackingNumber)
            <div class="tracking-box">
                <p style="margin: 0 0 10px 0;"><strong>📍 Tracking Number:</strong></p>
                <div class="tracking-number">{{ $trackingNumber }}</div>
                <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">Use this number to track your shipment</p>
            </div>
        @endif
        
        @if($newStatus === 'PROCESSING')
            <p>We're currently preparing your order for shipment. You'll receive another email with tracking information once it ships.</p>
        @elseif($newStatus === 'SHIPPED')
            <p>Your order is on its way! You can track your shipment using the tracking number above.</p>
        @elseif($newStatus === 'DELIVERED')
            <p>Your order has been successfully delivered. We hope you enjoy your purchase!</p>
            <p>If you have any issues with your order, please contact our support team within 7 days.</p>
        @elseif($newStatus === 'CANCELLED')
            <p>Your order has been cancelled. If you have any questions about this cancellation, please contact our support team.</p>
        @endif
        
        <center>
            <a href="{{ $orderUrl }}" class="button">View Order Details</a>
        </center>
        
        <p>If you have any questions about your order, please don't hesitate to contact us.</p>
        
        <p>Best regards,<br>The KEOHAMS Team</p>
    </div>
    <div class="footer">
        <p>&copy; {{ date('Y') }} KEOHAMS. All rights reserved.</p>
        <p>This is an automated email. Please do not reply to this message.</p>
    </div>
</body>
</html>
