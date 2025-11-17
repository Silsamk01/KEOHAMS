<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quotation Reply</title>
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
        .quotation-box {
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
        .note-box {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
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
        <p>📋 Quotation Reply Received</p>
    </div>
    <div class="content">
        <p>Hello {{ $user->first_name }},</p>
        
        <p>Great news! We've prepared a quotation for your request. Please review the details below:</p>
        
        <div class="quotation-box">
            <h3 style="margin-top: 0;">Quotation Details</h3>
            
            <p><strong>Quotation ID:</strong> #{{ $quotation->id }}</p>
            <p><strong>Status:</strong> {{ $quotation->status }}</p>
            <p><strong>Valid Until:</strong> {{ $quotation->valid_until ? $quotation->valid_until->format('M d, Y') : 'Contact us' }}</p>
            
            <h4>Quoted Items:</h4>
            
            @foreach($items as $item)
                <div class="item">
                    <strong>{{ $item['product_name'] ?? $item['description'] }}</strong><br>
                    Quantity: {{ $item['quantity'] }}<br>
                    @if(isset($item['unit_price']))
                        Unit Price: ₦{{ number_format($item['unit_price'], 2) }}<br>
                        Subtotal: ₦{{ number_format($item['subtotal'], 2) }}
                    @else
                        <em>Price available upon review</em>
                    @endif
                </div>
            @endforeach
            
            @if($quotation->total_price)
                <div class="total">
                    Total: ₦{{ number_format($quotation->total_price, 2) }}
                </div>
            @endif
            
            @if($quotation->admin_notes)
                <div class="note-box">
                    <strong>📝 Notes from our team:</strong>
                    <p style="margin: 10px 0 0 0;">{{ $quotation->admin_notes }}</p>
                </div>
            @endif
        </div>
        
        <center>
            <a href="{{ $quotationUrl }}" class="button">View Full Quotation</a>
        </center>
        
        <p><strong>Next Steps:</strong></p>
        <ol>
            <li>Review the quotation details carefully</li>
            <li>Contact us if you have any questions or need modifications</li>
            <li>Place your order directly from the quotation page</li>
            <li>We'll process your order as soon as we receive confirmation</li>
        </ol>
        
        <p><strong>📞 Need Help?</strong></p>
        <p>If you have any questions about this quotation or need to request changes, please contact our sales team or use the support chat in your dashboard.</p>
        
        <p>This quotation was prepared at: {{ $repliedAt }}</p>
        
        <p>We look forward to doing business with you!</p>
        
        <p>Best regards,<br>The KEOHAMS Sales Team</p>
    </div>
    <div class="footer">
        <p>&copy; {{ date('Y') }} KEOHAMS. All rights reserved.</p>
        <p>This is an automated email. Please do not reply to this message.</p>
    </div>
</body>
</html>
