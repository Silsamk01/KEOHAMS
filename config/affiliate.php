<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Affiliate System Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration for the KEOHAMS affiliate/MLM system
    |
    */

    // Default commission rate for new affiliates (percentage)
    'default_commission_rate' => env('AFFILIATE_DEFAULT_RATE', 10.0),

    // Multi-level commission rates by level
    'level_rates' => [
        1 => 10.0,  // Direct referral: 10%
        2 => 5.0,   // Level 2: 5%
        3 => 2.5,   // Level 3: 2.5%
        4 => 1.0,   // Level 4: 1%
        5 => 0.5,   // Level 5: 0.5%
    ],

    // Maximum commission levels (depth of MLM tree)
    'max_commission_levels' => env('AFFILIATE_MAX_LEVELS', 3),

    // Withdrawal settings
    'min_withdrawal' => env('AFFILIATE_MIN_WITHDRAWAL', 1000), // ₦1,000
    'max_withdrawal' => env('AFFILIATE_MAX_WITHDRAWAL', 1000000), // ₦1,000,000
    'withdrawal_fee' => env('AFFILIATE_WITHDRAWAL_FEE', 0), // Fixed fee or percentage
    'withdrawal_fee_type' => env('AFFILIATE_WITHDRAWAL_FEE_TYPE', 'fixed'), // 'fixed' or 'percentage'

    // Payment methods for withdrawals
    'payment_methods' => [
        'bank_transfer' => [
            'enabled' => true,
            'label' => 'Bank Transfer',
            'fields' => ['bank_name', 'account_number', 'account_name'],
        ],
        'paystack' => [
            'enabled' => true,
            'label' => 'Paystack',
            'fields' => ['account_number', 'bank_name', 'account_name'],
        ],
        'wallet' => [
            'enabled' => true,
            'label' => 'Wallet Top-up',
            'fields' => [],
        ],
    ],

    // Commission approval settings
    'auto_approve_commission' => env('AFFILIATE_AUTO_APPROVE', false),
    'commission_approval_days' => env('AFFILIATE_APPROVAL_DAYS', 7), // Days after order delivery

    // Referral tracking
    'cookie_duration' => env('AFFILIATE_COOKIE_DURATION', 30), // Days
    'track_clicks' => env('AFFILIATE_TRACK_CLICKS', true),

    // Affiliate levels/tiers (based on performance)
    'affiliate_tiers' => [
        'bronze' => [
            'min_earnings' => 0,
            'max_earnings' => 50000,
            'commission_bonus' => 0,
        ],
        'silver' => [
            'min_earnings' => 50000,
            'max_earnings' => 200000,
            'commission_bonus' => 2, // +2% bonus
        ],
        'gold' => [
            'min_earnings' => 200000,
            'max_earnings' => 500000,
            'commission_bonus' => 5, // +5% bonus
        ],
        'platinum' => [
            'min_earnings' => 500000,
            'max_earnings' => PHP_INT_MAX,
            'commission_bonus' => 10, // +10% bonus
        ],
    ],

    // Minimum referrals required to be active
    'min_active_referrals' => env('AFFILIATE_MIN_REFERRALS', 0),

    // Email notifications
    'notifications' => [
        'new_referral' => true,
        'commission_earned' => true,
        'commission_approved' => true,
        'withdrawal_approved' => true,
        'withdrawal_rejected' => true,
        'weekly_summary' => true,
        'monthly_summary' => true,
    ],

    // Dashboard settings
    'dashboard' => [
        'show_downline_earnings' => true,
        'show_leaderboard' => true,
        'max_tree_levels' => 5,
    ],

    // Referral link settings
    'referral_link_base' => env('APP_URL') . '/register',
    'referral_param' => 'ref',

    // Anti-fraud settings
    'fraud_detection' => [
        'enabled' => true,
        'max_daily_referrals' => 10,
        'max_same_ip_referrals' => 3,
        'require_kyc_for_withdrawal' => true,
        'min_order_amount' => 1000, // Minimum order amount to generate commission
    ],
];
