<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmation</title>
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
        .order-summary {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
        }
        .item {
            border-bottom: 1px solid #eee;
            padding: 15px 0;
        }
        .item:last-child {
            border-bottom: none;
        }
        .total {
            background: #667eea;
            color: white;
            padding: 15px;
            border-radius: 5px;
            margin-top: 15px;
            font-size: 18px;
            font-weight: bold;
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
        <p>Order Confirmation</p>
        <h2 style="margin: 0;">Order #{{ $order->order_number }}</h2>
    </div>
    <div class="content">
        <p>Hello {{ $user->first_name }},</p>
        
        <p>Thank you for your order! We've received your order and will begin processing it shortly.</p>
        
        <div class="order-summary">
            <h3 style="margin-top: 0;">Order Details</h3>
            
            <p><strong>Order Number:</strong> {{ $order->order_number }}</p>
            <p><strong>Order Date:</strong> {{ $order->created_at->format('M d, Y h:i A') }}</p>
            <p><strong>Status:</strong> {{ $order->status }}</p>
            
            <h4>Items Ordered:</h4>
            
            @foreach($items as $item)
                <div class="item">
                    <strong>{{ $item->product->name }}</strong><br>
                    Quantity: {{ $item->quantity }}<br>
                    Price: ₦{{ number_format($item->unit_price, 2) }}<br>
                    Subtotal: ₦{{ number_format($item->subtotal, 2) }}
                </div>
            @endforeach
            
            <div style="margin-top: 20px; padding-top: 15px; border-top: 2px solid #667eea;">
                <p style="margin: 5px 0;"><strong>Subtotal:</strong> ₦{{ number_format($order->subtotal, 2) }}</p>
                @if($order->discount_amount > 0)
                    <p style="margin: 5px 0;"><strong>Discount:</strong> -₦{{ number_format($order->discount_amount, 2) }}</p>
                @endif
                @if($order->shipping_fee > 0)
                    <p style="margin: 5px 0;"><strong>Shipping:</strong> ₦{{ number_format($order->shipping_fee, 2) }}</p>
                @endif
                @if($order->tax > 0)
                    <p style="margin: 5px 0;"><strong>Tax:</strong> ₦{{ number_format($order->tax, 2) }}</p>
                @endif
            </div>
            
            <div class="total">
                Total: ₦{{ number_format($order->total, 2) }}
            </div>
            
            @if($order->shippingAddress)
                <h4>Shipping Address:</h4>
                <p style="background: #f9f9f9; padding: 15px; border-radius: 5px;">
                    {{ $order->shippingAddress->address_line1 }}<br>
                    @if($order->shippingAddress->address_line2)
                        {{ $order->shippingAddress->address_line2 }}<br>
                    @endif
                    {{ $order->shippingAddress->city }}, {{ $order->shippingAddress->state }}<br>
                    {{ $order->shippingAddress->country }}
                </p>
            @endif
        </div>
        
        <center>
            <a href="{{ $orderUrl }}" class="button">View Order Details</a>
        </center>
        
        <p>We'll send you another email when your order ships.</p>
        
        <p>Best regards,<br>The KEOHAMS Team</p>
    </div>
    <div class="footer">
        <p>&copy; {{ date('Y') }} KEOHAMS. All rights reserved.</p>
        <p>This is an automated email. Please do not reply to this message.</p>
    </div>
</body>
</html>
