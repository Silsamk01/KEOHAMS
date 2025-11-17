<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Support Ticket Response</title>
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
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
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
        .ticket-box {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            border-left: 4px solid #4facfe;
        }
        .message-box {
            background: #e3f2fd;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
        }
        .button {
            display: inline-block;
            padding: 15px 30px;
            background: #4facfe;
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
        <h1>KEOHAMS Support</h1>
        <p>💬 New Response to Your Ticket</p>
    </div>
    <div class="content">
        <p>Hello {{ $user->first_name }},</p>
        
        <p>Our support team has responded to your ticket. Here are the details:</p>
        
        <div class="ticket-box">
            <h3 style="margin-top: 0;">Ticket Information</h3>
            <p><strong>Ticket ID:</strong> #{{ $ticket->id }}</p>
            <p><strong>Subject:</strong> {{ $ticket->subject }}</p>
            <p><strong>Status:</strong> {{ $ticket->status }}</p>
            <p><strong>Priority:</strong> {{ $ticket->priority }}</p>
            @if($ticket->assignedTo)
                <p><strong>Assigned To:</strong> {{ $ticket->assignedTo->first_name }} {{ $ticket->assignedTo->last_name }}</p>
            @endif
        </div>
        
        <div class="message-box">
            <h4 style="margin-top: 0;">Latest Response:</h4>
            <p><strong>From:</strong> {{ $message->sender->first_name }} {{ $message->sender->last_name }}</p>
            <p><strong>Sent:</strong> {{ $message->created_at->format('M d, Y h:i A') }}</p>
            <hr style="border: none; border-top: 1px solid #ccc; margin: 15px 0;">
            <div style="white-space: pre-wrap;">{{ $message->message }}</div>
        </div>
        
        <center>
            <a href="{{ $ticketUrl }}" class="button">View Ticket & Reply</a>
        </center>
        
        <p><strong>📌 What's Next?</strong></p>
        <ul>
            <li>Review the response from our support team</li>
            <li>Click the button above to reply if you need further assistance</li>
            <li>Mark the ticket as resolved if your issue is solved</li>
        </ul>
        
        <p><strong>⏱️ Response Times:</strong></p>
        <ul>
            <li>High Priority: Within 4 hours</li>
            <li>Medium Priority: Within 24 hours</li>
            <li>Low Priority: Within 48 hours</li>
        </ul>
        
        <p>We're here to help! If you have any additional questions, feel free to reply to this ticket.</p>
        
        <p>Best regards,<br>The KEOHAMS Support Team</p>
    </div>
    <div class="footer">
        <p>&copy; {{ date('Y') }} KEOHAMS. All rights reserved.</p>
        <p>This is an automated email. Please do not reply to this message.</p>
        <p>Please use the ticket system to communicate with our support team.</p>
    </div>
</body>
</html>
