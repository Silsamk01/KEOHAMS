# KEOHAMS Affiliate System - Complete Implementation Guide

## Overview
The KEOHAMS Affiliate System is a comprehensive multi-level affiliate marketing platform that allows users to earn commissions on direct sales and network referrals. The system implements a 10% direct sales commission with 2.5% recursive upline commissions, includes admin verification of payments, and provides comprehensive dashboards for both affiliates and administrators.

## System Architecture

### Database Structure
The affiliate system uses the following main tables:

1. **affiliates** - Core affiliate records
   - Links to users table
   - Unique referral codes
   - Parent-child relationships for network hierarchy
   - Balance tracking (total_earnings, available_balance, pending_balance)
   - Network size metrics (direct_referrals, total_downline)

2. **affiliate_sales** - Sales records requiring verification
   - Links to affiliates and customers
   - Unique sale references (prevents duplicates)
   - Payment method and details
   - Admin verification workflow
   - Commission payment tracking

3. **commission_records** - Individual commission entries
   - Links to sales and affiliates
   - Level-based commission tracking
   - Unique constraint prevents duplicate payouts
   - Status tracking (PENDING/PAID/CANCELLED)

4. **commission_settings** - Configurable rate structure
   - Level-based rates (0=direct, 1+=upline)
   - Maximum total commission cap
   - Admin-configurable through interface

5. **affiliate_withdrawals** - Payout request tracking
   - Withdrawal requests and processing
   - Multiple payment methods support
   - Admin approval workflow

### Commission Structure
- **Direct Sales (Level 0)**: 10% commission
- **Network Sales (Level 1+)**: 2.5% per upline level
- **Maximum Total**: 25% cap (configurable)
- **Recursive Calculation**: Continues until no more uplines or cap reached

## API Endpoints

### Affiliate Management (/api/affiliate)
- `GET /referral/:code` - Public endpoint to validate referral codes
- `POST /register` - Register new affiliate with optional parent referral
- `GET /dashboard/:user_id` - Complete affiliate dashboard data
- `GET /stats/:user_id` - Affiliate statistics and metrics
- `GET /network/:user_id` - Upline/downline tree structure
- `POST /sales/:user_id` - Record new sale for verification
- `GET /sales/:user_id` - List affiliate's sales with pagination
- `GET /commissions/:user_id` - Commission history with pagination
- `GET /commission-preview/:user_id` - Preview potential earnings
- `PUT /profile/:user_id` - Update affiliate profile

### Admin Management (/api/admin/affiliate)
- `GET /stats` - System-wide affiliate statistics
- `GET /list` - List all affiliates with search/pagination
- `GET /:id/details` - Detailed affiliate information
- `PATCH /:id/status` - Activate/deactivate affiliates
- `GET /sales/pending` - Sales awaiting verification
- `POST /sales/:id/verify` - Approve/reject sales
- `GET /commissions/unpaid` - Verified sales with unpaid commissions
- `POST /commissions/release` - Release commission payments
- `GET /settings/commission` - Get commission rate settings
- `PUT /settings/commission` - Update commission rates

## Frontend Components

### Affiliate Dashboard (/affiliate-dashboard)
**Features:**
- Registration flow for new affiliates
- Earnings overview with real-time balances
- Sales tracking and recording interface
- Commission history with detailed breakdowns
- Network visualization (upline/downline trees)
- Referral tools (links, codes, commission calculator)
- Responsive design with Bootstrap 5

**Key Sections:**
- Overview: Quick stats and recent activity
- Sales: Record new sales and view history
- Commissions: Track earnings by level and status
- Network: Visualize affiliate hierarchy
- Tools: Referral links and commission calculator

### Admin Panel Integration
**Features:**
- Integrated into existing admin dashboard
- Real-time pending sales notifications
- Bulk commission release functionality
- Affiliate management and status control
- Commission rate configuration
- System statistics and reporting

**Admin Tabs:**
- Overview: System statistics and recent activity
- Sales Verification: Approve/reject pending sales
- Commission Management: Release payments to affiliates
- Affiliate List: Manage affiliate accounts
- Settings: Configure commission rates and system parameters

### Main Website Integration
**Features:**
- Prominent affiliate program section on homepage
- Navigation menu integration for authenticated users
- Call-to-action buttons throughout the site
- Referral code validation and tracking

## Security & Duplicate Prevention

### Database Level Protection
- Unique constraints on critical fields (referral_code, sale_reference)
- Foreign key relationships ensure data integrity
- Composite unique constraint on commission_records (sale_id, affiliate_id, level)

### Application Level Safeguards
- Transaction-based operations for critical functions
- Double-checking within transactions to prevent race conditions
- Comprehensive validation before commission calculations
- Audit logging for all administrative actions

### Key Safeguards:
1. **Sale Reference Uniqueness**: Prevents duplicate sale entries
2. **Commission Record Uniqueness**: Prevents duplicate commission payouts
3. **Status Checking**: Multiple verification points for sale and commission status
4. **Transaction Atomicity**: Ensures all-or-nothing operations
5. **Admin Audit Trail**: Logs all administrative actions

## Commission Calculation Engine

### Algorithm Flow:
1. **Validation**: Verify sale exists and is verified
2. **Duplicate Check**: Ensure no existing commission records
3. **Hierarchy Building**: Get affiliate upline chain
4. **Rate Application**: Apply commission rates by level
5. **Cap Enforcement**: Stop when maximum total rate reached
6. **Database Storage**: Store commission records atomically
7. **Balance Updates**: Update affiliate pending balances

### Example Calculation:
Sale Amount: $1000
- Level 0 (Direct): $100 (10%)
- Level 1 (Upline): $25 (2.5%)
- Level 2 (Upline): $25 (2.5%)
- Total Commissions: $150 (15%)

## Installation & Setup

### Database Migration
```bash
cd backend
npx knex migrate:latest
```

### Configuration
The system uses existing environment variables and doesn't require additional configuration.

### File Structure
```
backend/src/
├── migrations/20251112_027_affiliate_system.js
├── models/
│   ├── affiliate.js
│   ├── affiliateSale.js
│   └── commissionRecord.js
├── services/commissionService.js
├── controllers/affiliateController.js
└── routes/affiliate.js

frontend/
├── pages/affiliate-dashboard.html
└── src/js/admin-affiliate.js
```

## Usage Examples

### For Affiliates:
1. **Registration**: Visit affiliate dashboard, enter optional parent referral code
2. **Recording Sales**: Use dashboard form to record sales with payment details
3. **Tracking Earnings**: Monitor commissions in real-time dashboard
4. **Sharing Links**: Use generated referral links and codes
5. **Network Building**: View downline growth and earnings

### For Administrators:
1. **Sales Verification**: Review payment details and approve/reject sales
2. **Commission Release**: Release payments for verified sales
3. **Affiliate Management**: Activate/deactivate affiliates as needed
4. **System Configuration**: Adjust commission rates and settings
5. **Reporting**: Monitor system-wide performance and statistics

## Key Features Summary

✅ **Multi-level Commission Structure** - 10% direct + 2.5% recursive upline
✅ **Admin Verification System** - Sales require admin approval before commission calculation
✅ **Duplicate Prevention** - Multiple safeguards prevent double payouts
✅ **Real-time Dashboard** - Complete affiliate interface with sales tracking
✅ **Admin Management Panel** - Comprehensive administrative controls
✅ **Network Visualization** - Upline/downline tree views
✅ **Commission Calculator** - Preview potential earnings
✅ **Referral Tools** - Automatic link generation and tracking
✅ **Responsive Design** - Mobile-friendly interfaces
✅ **Audit Trail** - Complete logging of administrative actions
✅ **Database Integrity** - Foreign keys, constraints, and validation
✅ **Transaction Safety** - Atomic operations for critical functions

## Future Enhancements

Potential improvements that could be added:
- Email notifications for commission payments
- Withdrawal request system
- Advanced reporting and analytics
- Automated payment processing integration
- Mobile app development
- Advanced fraud detection
- Performance bonuses and incentives
- White-label affiliate portal
- API access for third-party integrations
- Multi-currency support

The affiliate system is now fully operational and ready for production use with comprehensive features for both affiliates and administrators.