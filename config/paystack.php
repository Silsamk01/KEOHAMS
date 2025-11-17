<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Paystack Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration for Paystack payment gateway integration
    |
    */

    'secret_key' => env('PAYSTACK_SECRET_KEY'),
    
    'public_key' => env('PAYSTACK_PUBLIC_KEY'),
    
    'merchant_email' => env('MAIL_FROM_ADDRESS', 'noreply@keohams.com'),
    
    // Paystack API base URL
    'base_url' => 'https://api.paystack.co',
    
    // Supported currencies
    'currencies' => ['NGN', 'GHS', 'ZAR', 'USD'],
    
    // Default currency
    'default_currency' => 'NGN',
    
    // Webhook URL (will be: https://yourdomain.com/api/v1/webhooks/paystack)
    'webhook_url' => env('APP_URL') . '/api/v1/webhooks/paystack',
    
    // Success/Failure callback URLs
    'callback_url' => env('APP_URL') . '/payment-callback',
    
    // Payment channels to accept
    'channels' => ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
    
    // Transaction fees (in percentage)
    'local_transaction_fee' => 1.5, // 1.5% for local cards
    'international_transaction_fee' => 3.9, // 3.9% for international cards
    'fee_cap' => 2000, // NGN 2,000 cap for local transactions
    
    // Enable logging
    'log_requests' => env('APP_ENV') === 'production',
    
];
