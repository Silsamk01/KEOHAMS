# KEOHAMS Admin Guide

**Administrator Manual for KEOHAMS E-Commerce Platform**

Version 1.0 | Last Updated: November 16, 2025

---

## Table of Contents

1. [Admin Access](#admin-access)
2. [Dashboard Overview](#dashboard-overview)
3. [User Management](#user-management)
4. [Product Management](#product-management)
5. [Category Management](#category-management)
6. [Order Management](#order-management)
7. [Payment Management](#payment-management)
8. [Blog Management](#blog-management)
9. [Quotation Management](#quotation-management)
10. [KYC Management](#kyc-management)
11. [Affiliate Management](#affiliate-management)
12. [Notification System](#notification-system)
13. [Security Management](#security-management)
14. [Reports & Analytics](#reports--analytics)
15. [System Settings](#system-settings)
16. [Maintenance](#maintenance)

---

## Admin Access

### Logging In

**Admin Panel URL:** `https://keohams.com/admin`

**Default Credentials:** (Change immediately after first login)
- Email: `admin@keohams.com`
- Password: `Admin@123`

### First Time Setup

1. Login with default credentials
2. Go to Profile Settings
3. Change password immediately
4. Enable Two-Factor Authentication
5. Update profile information

### Admin Roles

**Super Admin:**
- Full system access
- User management
- System configuration
- Cannot be deleted

**Admin:**
- Manage products, orders, users
- View reports
- Limited system settings access

**Manager:**
- Manage orders
- View products
- Customer support functions

**Editor:**
- Content management
- Blog posts
- Product descriptions

### Security Best Practices

✅ Use strong, unique password  
✅ Enable 2FA  
✅ Don't share admin credentials  
✅ Log out after session  
✅ Use private/incognito for public computers  
✅ Review security logs regularly  

---

## Dashboard Overview

### Main Dashboard

**Key Metrics Displayed:**

**Sales Overview:**
- Today's Sales
- This Week's Sales
- This Month's Sales
- Total Revenue

**Order Statistics:**
- Pending Orders
- Processing Orders
- Shipped Orders
- Delivered Orders
- Cancelled Orders

**User Statistics:**
- Total Users
- New Users Today
- Active Users
- Verified KYC Users

**Inventory Alerts:**
- Low Stock Products
- Out of Stock Products
- Products Expiring Soon

**Recent Activity:**
- Latest Orders
- New User Registrations
- Pending Quotations
- Recent Reviews

### Charts & Graphs

**Sales Chart:**
- Daily/Weekly/Monthly sales trends
- Compare with previous periods
- Revenue by category

**Order Status Distribution:**
- Pie chart of order statuses
- Processing time analytics

**Top Products:**
- Best selling products
- Most viewed products
- Highest rated products

### Quick Actions

- Add New Product
- Process Pending Orders
- View Support Tickets
- Approve Quotations
- Verify KYC Documents

---

## User Management

### Viewing Users

**Access:** Admin Panel → Users

**User List Shows:**
- User ID
- Name & Email
- Phone Number
- Registration Date
- Status (Active, Inactive, Suspended)
- Role
- KYC Status
- Total Orders
- Actions

### Search & Filter

**Search By:**
- Name
- Email
- Phone Number
- User ID

**Filter Options:**
- Status: All, Active, Inactive, Suspended
- Role: Customer, Admin, Manager
- KYC: Verified, Pending, Not Submitted
- Registration Date Range

### User Details

Click on user to view:
- Personal Information
- Order History
- Payment History
- KYC Documents
- Security Events
- Affiliate Performance
- Address Book

### Creating New User

1. Click **"Add New User"**
2. Fill in details:
   - Name
   - Email
   - Phone
   - Password
   - Role
3. Set initial status
4. Click **"Create User"**

### Editing User

1. Click edit icon on user row
2. Update information
3. Save changes

**Editable Fields:**
- Name, Email, Phone
- Role (careful with permissions)
- Status
- Address Information

### User Actions

**Activate/Deactivate:**
- Click toggle switch
- Confirm action
- User notified by email

**Suspend Account:**
1. Click **"Suspend"**
2. Enter reason
3. Confirm suspension
4. User cannot login until reactivated

**Reset Password:**
1. Click **"Reset Password"**
2. Choose:
   - Auto-generate and email
   - Set manually
3. Confirm action

**Delete User:**
- Only possible if no orders
- Requires confirmation
- Permanent action

**Impersonate User:** (for support purposes)
1. Click **"Login As User"**
2. View site as that user
3. Exit impersonation when done

### Bulk Actions

Select multiple users:
- Export to CSV
- Send bulk email
- Change status
- Delete (if eligible)

---

## Product Management

### Product List

**Access:** Admin Panel → Products

**View Options:**
- Grid View
- List View
- Table View

**Columns:**
- Image
- Name & SKU
- Category
- Price
- Stock
- Status
- Featured
- Actions

### Adding New Product

**Step 1: Basic Information**
1. Click **"Add Product"**
2. Enter:
   - Product Name
   - SKU (auto-generated or custom)
   - Short Description
   - Full Description

**Step 2: Pricing**
- Regular Price
- Sale Price (optional)
- Cost Price (for profit tracking)
- Tax Class

**Step 3: Inventory**
- Stock Quantity
- Enable Stock Management
- Low Stock Threshold
- Allow Backorders?

**Step 4: Product Details**
- Category (required)
- Brand
- Tags
- Weight & Dimensions
- Shipping Class

**Step 5: Images**
- Upload main image
- Upload gallery images (max 10)
- Set featured image
- Add alt text for SEO

**Step 6: Variations** (if applicable)
- Size variations
- Color variations
- Custom attributes

**Step 7: SEO**
- Meta Title
- Meta Description
- URL Slug
- Focus Keywords

**Step 8: Additional**
- Product Specifications
- Related Products
- Upsell Products
- Cross-sell Products

**Step 9: Status**
- Draft / Published
- Featured Product?
- Visibility (Public/Private)

### Editing Products

1. Click product name or edit icon
2. Update any section
3. Click **"Update Product"**

### Quick Edit

For fast updates:
1. Hover over product
2. Click **"Quick Edit"**
3. Change:
   - Price
   - Stock
   - Status
   - Featured
4. Save changes

### Bulk Operations

Select multiple products:
- Change Category
- Update Status
- Set Featured
- Delete
- Export

### Product Import/Export

**Import Products:**
1. Go to **"Import"**
2. Download CSV template
3. Fill in product details
4. Upload CSV file
5. Map columns
6. Import

**Export Products:**
1. Go to **"Export"**
2. Select filters
3. Choose format (CSV, Excel)
4. Download file

### Managing Stock

**Update Stock:**
- Manual adjustment
- Import via CSV
- Auto-update from orders

**Stock Alerts:**
- Low stock notifications
- Out of stock notifications
- Email alerts to admin

**Stock History:**
- View stock changes
- Track who made changes
- Date/time stamps

### Product Reviews

**Managing Reviews:**
- Approve/Reject pending reviews
- Edit inappropriate content
- Delete spam reviews
- Respond to reviews

---

## Category Management

### Category Hierarchy

**Parent Categories:**
- Top-level categories
- Can have subcategories

**Subcategories:**
- Nested under parent
- Unlimited levels

### Creating Category

1. Go to **Categories**
2. Click **"Add Category"**
3. Enter:
   - Name
   - Slug (URL-friendly)
   - Description
   - Parent Category (if sub)
4. Upload category image
5. Set display order
6. Set status
7. Save category

### Category Settings

**Display Options:**
- Show on homepage
- Display order
- Number of products to show
- Layout style

**SEO Settings:**
- Meta title
- Meta description
- Keywords

### Managing Categories

**Edit:** Update details anytime  
**Delete:** Only if no products assigned  
**Reorder:** Drag and drop to reorder  
**Merge:** Combine categories  

---

## Order Management

### Order List

**Access:** Admin Panel → Orders

**Order Information:**
- Order Number
- Customer Name
- Date & Time
- Items Count
- Total Amount
- Payment Status
- Order Status
- Actions

### Order Statuses

**Pending:** New order, needs processing  
**Processing:** Being prepared  
**Shipped:** On the way  
**Delivered:** Successfully delivered  
**Cancelled:** Order cancelled  
**Refunded:** Payment refunded  

### Viewing Order Details

Click order to view:
- Customer information
- Items ordered with prices
- Subtotal, tax, shipping
- Total amount
- Payment method
- Payment status
- Shipping address
- Billing address
- Order notes
- Status timeline

### Processing Orders

**Step 1: Review Order**
- Verify customer details
- Check product availability
- Confirm payment received

**Step 2: Update Status**
1. Click **"Change Status"**
2. Select new status
3. Add notes (optional)
4. Check "Notify Customer"
5. Update

**Step 3: Generate Invoice**
- Click **"Generate Invoice"**
- PDF invoice created
- Email to customer

**Step 4: Arrange Shipping**
- Enter tracking number
- Select courier
- Notify customer

### Order Actions

**Print Order:**
- Print invoice
- Print packing slip
- Print shipping label

**Send Email:**
- Order confirmation
- Shipping notification
- Delivery confirmation

**Refund Order:**
1. Click **"Refund"**
2. Select items to refund
3. Enter refund amount
4. Add refund reason
5. Process refund

**Cancel Order:**
1. Click **"Cancel"**
2. Enter cancellation reason
3. Confirm cancellation
4. Refund if paid

### Bulk Order Actions

- Export to CSV
- Print multiple invoices
- Change status
- Send bulk notifications

### Order Notes

**Internal Notes:**
- Only visible to admins
- Track order progress
- Record communications

**Customer Notes:**
- Visible to customer
- Order updates
- Important information

### Managing Returns

**Return Request:**
1. Customer initiates return
2. Admin reviews request
3. Approve or reject
4. Arrange pickup/return shipping
5. Process refund after inspection

---

## Payment Management

### Payment Methods

**Paystack:**
- Card payments
- Bank transfers
- USSD payments

**Configuration:**
1. Go to **Settings → Payments**
2. Enable Paystack
3. Enter API keys (public & secret)
4. Set callback URL
5. Save settings

### Transaction History

**View All Transactions:**
- Payment reference
- Order number
- Customer
- Amount
- Payment method
- Status
- Date/Time

### Payment Verification

**Manual Verification:**
1. Customer uploads proof
2. Admin reviews proof
3. Verify with bank statement
4. Update payment status

### Refunds

**Processing Refunds:**
1. Navigate to order
2. Click **"Refund"**
3. Select refund method:
   - Card refund (automatic)
   - Bank transfer (manual)
4. Enter amount
5. Add reason
6. Process

**Refund Timeline:**
- Card refunds: 5-10 business days
- Bank transfers: 2-3 business days

### Payment Reports

**Generate Reports:**
- Daily/Weekly/Monthly payments
- Payment method breakdown
- Failed transactions
- Pending payments
- Refund summary

---

## Blog Management

### Post List

**Access:** Admin Panel → Blog → Posts

**View:**
- Post title
- Author
- Category
- Status
- Published date
- Views
- Comments

### Creating Blog Post

**Step 1: Content**
1. Click **"Add New Post"**
2. Enter title
3. Write content (WYSIWYG editor)
4. Add excerpt

**Step 2: Media**
- Upload featured image
- Add images to content
- Embed videos

**Step 3: Settings**
- Select category
- Add tags
- Set author
- Choose visibility

**Step 4: SEO**
- Meta title
- Meta description
- Focus keyword
- URL slug

**Step 5: Publish**
- Save as draft
- Schedule for later
- Publish immediately

### Post Categories

**Managing Categories:**
- Create category
- Set parent category
- Add description
- Assign display order

### Post Tags

**Tag Management:**
- Add new tags
- Merge tags
- Delete unused tags

### Comments Management

**Comment Moderation:**
1. Go to **Comments**
2. View pending comments
3. Approve/Reject/Spam
4. Edit if needed
5. Reply to comments

**Spam Protection:**
- Auto-detect spam
- Manual spam marking
- Blacklist words
- IP blocking

---

## Quotation Management

### Quotation Requests

**Access:** Admin Panel → Quotations

**Request Details:**
- Reference number
- Customer information
- Requested items
- Quantities
- Special requirements
- Requested delivery date
- Status

### Processing Quotations

**Step 1: Review Request**
- Check product availability
- Verify quantities
- Assess special requirements

**Step 2: Calculate Pricing**
1. Click **"Process Quotation"**
2. Set unit prices
3. Apply discounts
4. Add shipping cost
5. Calculate total

**Step 3: Set Terms**
- Validity period (default 30 days)
- Payment terms
- Delivery terms
- Special conditions

**Step 4: Send Quote**
1. Review final quote
2. Add admin notes
3. Click **"Send to Customer"**
4. Customer notified via email

### Quotation Actions

**Approve:** Send approved quote to customer  
**Reject:** Decline request with reason  
**Revise:** Edit and resend quote  
**Convert to Order:** If customer accepts  

### Quotation Reports

- Total requests
- Approval rate
- Average quote value
- Response time

---

## KYC Management

### KYC Submissions

**Access:** Admin Panel → KYC Verifications

**View Submissions:**
- User name & email
- Submission date
- Document type
- Status
- Actions

### Reviewing KYC

**Step 1: Open Submission**
- Click on pending KYC request

**Step 2: Verify Documents**

**Check ID Document:**
- Clear and readable
- Not expired
- Name matches account
- Document number visible

**Check Selfie:**
- Face clearly visible
- Matches ID photo
- Not edited/filtered

**Check Proof of Address:**
- Recent (within 3 months)
- Name matches
- Address visible

**Step 3: Decision**

**Approve:**
1. Click **"Approve"**
2. User status updated to "Verified"
3. User notified

**Reject:**
1. Click **"Reject"**
2. Select rejection reason:
   - Blurry/unclear documents
   - Expired documents
   - Information mismatch
   - Incomplete submission
3. Add specific notes
4. User can resubmit

### KYC Statistics

- Total verified users
- Pending verifications
- Rejection rate
- Average verification time

---

## Affiliate Management

### Affiliate Overview

**Access:** Admin Panel → Affiliates

**Dashboard Shows:**
- Total affiliates
- Active affiliates
- Total commissions paid
- Pending payouts

### Managing Affiliates

**Affiliate List:**
- Affiliate name
- Code
- Referrals count
- Total earned
- Status
- Actions

### Commission Settings

**Configure Rates:**
1. Go to **Settings → Affiliate**
2. Set commission rates:
   - Level 1: 10%
   - Level 2: 5%
   - Level 3: 2.5%
3. Set minimum payout
4. Save settings

### Payout Management

**Viewing Payout Requests:**
- Request ID
- Affiliate name
- Amount requested
- Payment method
- Bank details
- Status

**Processing Payouts:**
1. Review request
2. Verify available balance
3. Check bank details
4. Process payment
5. Mark as **"Paid"**
6. Upload payment proof
7. Notify affiliate

### Affiliate Reports

**Generate Reports:**
- Top performing affiliates
- Commission breakdown
- Payout history
- Conversion rates

---

## Notification System

### Managing Notifications

**Access:** Admin Panel → Notifications

**Types:**
- System notifications
- User notifications
- Order notifications
- Security alerts

### Sending Notifications

**Individual User:**
1. Go to user profile
2. Click **"Send Notification"**
3. Write message
4. Select type
5. Send

**Bulk Notifications:**
1. Go to **"Send Bulk Notification"**
2. Select user group:
   - All users
   - Customers only
   - Verified users
   - Specific role
3. Write message
4. Schedule or send now

### Email Templates

**Managing Templates:**
1. Go to **Settings → Email Templates**
2. Select template:
   - Welcome email
   - Order confirmation
   - Shipping notification
   - Password reset
3. Edit content
4. Use variables: `{name}`, `{order_number}`
5. Preview
6. Save

### Push Notifications

**Configuration:**
1. Enable push notifications
2. Set up Firebase
3. Configure notification settings
4. Test notifications

---

## Security Management

### Security Dashboard

**Access:** Admin Panel → Security

**Overview:**
- Failed login attempts
- Blocked IPs
- Active sessions
- Security events

### Security Events

**Event Types:**
- Login attempts
- Password changes
- Profile updates
- Suspicious activity

**Event Details:**
- User ID
- Event type
- IP address
- Location
- Device
- Date/Time
- Status

### IP Management

**Blocked IPs:**
- View blocked IP addresses
- Block duration
- Reason
- Unblock if needed

**Whitelist:**
- Add trusted IP addresses
- Bypass rate limiting
- Admin access

### Rate Limiting

**Configure Limits:**
- Login attempts: 5 per minute
- API calls: 60 per minute
- Registration: 3 per hour

### Two-Factor Authentication

**Admin 2FA:**
- Enforce for all admins
- Require on sensitive actions
- Backup codes management

---

## Reports & Analytics

### Sales Reports

**Generate Reports:**
1. Go to **Reports → Sales**
2. Select date range
3. Choose metrics:
   - Total sales
   - Average order value
   - Products sold
   - Sales by category
4. View or export

**Report Formats:**
- Chart view
- Table view
- Export to CSV/Excel/PDF

### Customer Reports

**Metrics:**
- New customers
- Returning customers
- Customer lifetime value
- Top customers

### Product Reports

**Analytics:**
- Best sellers
- Worst performers
- Low stock
- Product views
- Conversion rate

### Financial Reports

**Reports Include:**
- Revenue summary
- Profit margins
- Payment methods breakdown
- Refunds and returns
- Tax collected

### Custom Reports

**Create Custom Report:**
1. Select data source
2. Choose metrics
3. Set filters
4. Add date range
5. Generate report
6. Schedule automated reports

---

## System Settings

### General Settings

**Access:** Admin Panel → Settings → General

**Configure:**
- Site name
- Site URL
- Admin email
- Timezone
- Date format
- Currency
- Language

### Email Settings

**SMTP Configuration:**
- SMTP host
- SMTP port
- Encryption (SSL/TLS)
- Username
- Password
- From name
- From email

**Test Email:**
- Send test email
- Verify delivery

### Payment Settings

**Payment Methods:**
- Enable/disable methods
- API credentials
- Test mode
- Webhook URLs

### Shipping Settings

**Shipping Zones:**
- Add zones
- Set rates per zone
- Free shipping threshold

**Shipping Methods:**
- Standard delivery
- Express delivery
- Pickup

### Tax Settings

**Configure Tax:**
- Enable/disable tax
- Tax rate
- Tax class
- Include in prices?

### Appearance Settings

**Customize:**
- Logo
- Favicon
- Color scheme
- Homepage layout
- Footer content

---

## Maintenance

### Backup Management

**Database Backup:**
```bash
php scripts/backup-database.php
```

**Schedule Backups:**
- Daily automatic backups
- Stored in `/storage/backups`
- Keep last 10 backups

### Cache Management

**Clear Cache:**
1. Go to **System → Cache**
2. Click **"Clear All Cache"**
3. Or use commands:
```bash
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear
```

**Warm Cache:**
```bash
php artisan cache:warmup
```

### Database Optimization

**Optimize Tables:**
```bash
php artisan db:optimize
```

**Run Monthly:**
- Reduces fragmentation
- Improves query performance

### System Health Check

**Run Health Check:**
```bash
php scripts/health-check.php
```

**Checks:**
- Database connection
- Cache system
- Storage permissions
- Required extensions
- OPcache status

### Performance Monitoring

**Access:** Admin Panel → System → Performance

**Metrics:**
- Response time
- Memory usage
- Query count
- Cache hit rate
- Slow queries

### Log Management

**View Logs:**
1. Go to **System → Logs**
2. View recent errors
3. Filter by level
4. Download logs

**Log Rotation:**
- Automatic rotation
- Keep 30 days
- Archive old logs

### Update System

**Check for Updates:**
1. Go to **System → Updates**
2. Check available updates
3. Review changelog
4. Backup before updating
5. Apply updates

---

## Best Practices

### Daily Tasks

✅ Check pending orders  
✅ Process payments  
✅ Review KYC submissions  
✅ Respond to support tickets  
✅ Monitor inventory  
✅ Check security logs  

### Weekly Tasks

✅ Review sales reports  
✅ Approve quotations  
✅ Process affiliate payouts  
✅ Update product descriptions  
✅ Review and approve blog comments  
✅ Check system performance  

### Monthly Tasks

✅ Analyze sales trends  
✅ Review top products  
✅ Update prices  
✅ Clean up old data  
✅ Optimize database  
✅ Review security settings  
✅ Generate financial reports  

---

## Troubleshooting

### Common Issues

**Can't Login:**
- Check credentials
- Clear browser cache
- Reset password
- Check if IP is blocked

**Orders Not Showing:**
- Check database connection
- Clear cache
- Check order status filters

**Payment Not Processing:**
- Verify API keys
- Check payment gateway status
- Review webhook configuration

**Images Not Uploading:**
- Check file size limits
- Verify storage permissions
- Check upload directory

---

## Support

**Technical Issues:**
- Email: Ohamskenneth08@gmail.com
- Check system logs
- Review documentation

**Feature Requests:**
- Submit via admin panel
- Email suggestions

---

**Admin Guide Version:** 1.0  
**Last Updated:** November 16, 2025  
**Platform Version:** Laravel 10.49.1
