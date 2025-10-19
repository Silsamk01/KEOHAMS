# Customer-Side KYC Implementation - Complete Guide

## 🎯 Overview

The KYC (Know Your Customer) system now requires customers to complete verification before accessing key platform features. This ensures compliance and security.

## 📋 Features Implemented

### Backend (API Layer)
1. **KYC Status in User Profile** (`/api/user/profile`)
   - Returns complete KYC status with every profile request
   - Status types: `NOT_SUBMITTED`, `PENDING`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`
   - Includes submission date, review date, admin remarks

2. **KYC Middleware** (`requireKYC`)
   - Blocks API access to protected endpoints
   - Returns clear error messages with KYC status
   - Suggests redirect to KYC submission page

3. **Protected Routes** (Requires KYC Approval)
   - `/api/products/:id/inquiry` - Product inquiries
   - `/api/quotations` - Request quotations
   - `/api/orders/create` - Create orders
   - More can be added as needed

### Frontend (Customer Experience)
1. **KYC Widget on Dashboard**
   - Prominent notification card showing KYC status
   - Different states: Not Submitted, Pending, Approved, Rejected
   - Action buttons to start/resubmit KYC
   - Auto-hides when approved

2. **Feature Locking**
   - Shop, Cart, Orders disabled until KYC approved
   - Clear messaging about why features are locked
   - One-click navigation to KYC submission

3. **Status-Based UI**
   - **Not Submitted**: Warning card with "Start KYC" button
   - **Pending**: Info card showing submission date, review timeline
   - **Approved**: Widget disappears, full access granted
   - **Rejected**: Error card with admin remarks, "Resubmit" button

## 🔄 User Flow

```
New User Login
      ↓
Dashboard Shows KYC Warning
      ↓
User Clicks "Start KYC Verification"
      ↓
Redirected to /kyc-enhanced.html
      ↓
Upload Documents (ID, Selfie, Address Proof)
      ↓
Status Changes to "PENDING"
      ↓
Dashboard Shows "Under Review" Message
      ↓
[Features Locked - 403 Errors on API]
      ↓
Admin Reviews in Admin Dashboard
      ↓
      ├─ APPROVED → Widget Disappears, Full Access
      └─ REJECTED → Shows Remarks, "Resubmit" Button
```

## 🛡️ Access Control Matrix

| Feature | No KYC | Pending KYC | Approved KYC | Rejected KYC |
|---------|--------|-------------|--------------|--------------|
| Browse Products | ✅ | ✅ | ✅ | ✅ |
| View Blog | ✅ | ✅ | ✅ | ✅ |
| Product Inquiry | ❌ | ❌ | ✅ | ❌ |
| Request Quotation | ❌ | ❌ | ✅ | ❌ |
| Place Orders | ❌ | ❌ | ✅ | ❌ |
| Shopping Cart | ❌ | ❌ | ✅ | ❌ |

## 📁 Files Created/Modified

### Backend Files:
1. **`backend/src/controllers/userController.js`** ✏️ Modified
   - Added KYC status to profile response
   - Returns submission details, review status, admin remarks

2. **`backend/src/middlewares/requireKYC.js`** ✨ New
   - `requireKYC()` - Blocks access, returns 403 if not approved
   - `optionalKYC()` - Adds headers but doesn't block
   - Clear error messages with redirect suggestions

3. **`backend/src/routes/products.js`** ✏️ Modified
   - Added `requireKYC` to `/products/:id/inquiry` endpoint

4. **`backend/src/routes/quotations.js`** ✏️ Modified
   - Added `requireKYC` to `POST /quotations` endpoint

5. **`backend/src/routes/orders.js`** ✏️ Modified
   - Added `requireKYC` to `POST /orders/create` endpoint

### Frontend Files:
6. **`frontend/src/js/kyc-widget.js`** ✨ New
   - Dashboard widget with status-based rendering
   - Auto-refresh on status changes
   - Feature locking/unlocking logic
   - Navigation prevention for locked features

7. **`frontend/pages/dashboard.html`** ✏️ Modified
   - Added `<div id="kycWidget"></div>` container
   - Included `kyc-widget.js` script

## 🔧 Configuration

### Add More Protected Routes
To require KYC for additional endpoints:

```javascript
// In any route file
const { requireKYC } = require('../middlewares/requireKYC');

router.post('/protected-endpoint', requireAuth, requireKYC, asyncHandler(ctrl.action));
```

### Customize KYC Widget Appearance
Edit `frontend/src/js/kyc-widget.js`:
- `renderNotSubmitted()` - First-time users
- `renderPending()` - Awaiting review
- `renderRejected()` - Needs resubmission

## 🎨 UI/UX Features

### Widget States:

**1. Not Submitted** (Yellow/Warning)
```
┌─────────────────────────────────────────────┐
│ ⚠️ KYC Verification Required                │
│                                              │
│ To access platform features like shopping,  │
│ quotations, and orders, you need to         │
│ complete your KYC verification.             │
│                                              │
│ ℹ️ Required: Government ID, Live Selfie,    │
│              Address Proof                  │
│                                              │
│ [Start KYC Verification]                    │
└─────────────────────────────────────────────┘
```

**2. Pending Review** (Blue/Info)
```
┌─────────────────────────────────────────────┐
│ ⏱️ KYC Under Review                         │
│                                              │
│ Your KYC documents are being reviewed by    │
│ our team. This usually takes 24-48 hours.   │
│                                              │
│ 📅 Submitted on Oct 18, 2025                │
│                                              │
│ 🔒 Access Restricted: You'll gain full      │
│    platform access once your KYC is         │
│    approved.                                 │
└─────────────────────────────────────────────┘
```

**3. Approved** (Widget Hidden)
- Widget completely disappears
- All features unlocked
- Full platform access

**4. Rejected** (Red/Danger)
```
┌─────────────────────────────────────────────┐
│ ❌ KYC Verification Rejected                │
│                                              │
│ Your KYC submission was rejected. Please    │
│ review the remarks below and resubmit.      │
│                                              │
│ ⚠️ Admin Remarks:                           │
│    Document expired. Please upload valid ID │
│                                              │
│ 📅 Reviewed on Oct 18, 2025                 │
│                                              │
│ [Resubmit KYC Documents]                    │
└─────────────────────────────────────────────┘
```

## 🔌 API Responses

### Profile Endpoint with KYC Status:
```json
GET /api/user/profile

{
  "id": 123,
  "name": "John Doe",
  "email": "john@example.com",
  "kyc": {
    "submitted": true,
    "status": "PENDING",
    "submittedAt": "2025-10-18T10:30:00.000Z",
    "reviewedAt": null,
    "adminRemarks": null,
    "autoDecision": "UNDER_REVIEW",
    "canResubmit": false
  }
}
```

### Protected Endpoint Error (No KYC):
```json
POST /api/quotations
403 Forbidden

{
  "message": "KYC verification required. Please complete your KYC submission to access this feature.",
  "requiresKYC": true,
  "kycStatus": "NOT_SUBMITTED",
  "redirectTo": "/kyc-enhanced.html"
}
```

### Protected Endpoint Error (Pending):
```json
POST /api/orders/create
403 Forbidden

{
  "message": "Your KYC submission is under review. Please wait for admin approval.",
  "requiresKYC": true,
  "kycStatus": "PENDING",
  "submittedAt": "2025-10-18T10:30:00.000Z"
}
```

### Protected Endpoint Error (Rejected):
```json
POST /api/products/123/inquiry
403 Forbidden

{
  "message": "Your KYC submission was rejected. Please resubmit with correct documents.",
  "requiresKYC": true,
  "kycStatus": "REJECTED",
  "adminRemarks": "Government ID has expired",
  "canResubmit": true,
  "redirectTo": "/kyc-enhanced.html"
}
```

## 🧪 Testing Guide

### 1. Test Not Submitted State
1. Create new user account
2. Login and go to dashboard
3. ✅ Should see yellow KYC warning card
4. ✅ Shop/Cart links should be disabled
5. ✅ Click "Start KYC" → redirects to `/kyc-enhanced.html`

### 2. Test Pending State
1. Submit KYC documents as user
2. Return to dashboard
3. ✅ Should see blue "Under Review" card
4. ✅ Try accessing protected features → 403 error

### 3. Test Approved State
1. As admin, approve the KYC submission
2. User refreshes dashboard
3. ✅ KYC widget disappears completely
4. ✅ All features unlocked
5. ✅ Can request quotations, place orders

### 4. Test Rejected State
1. As admin, reject the KYC with remarks
2. User refreshes dashboard
3. ✅ Should see red "Rejected" card
4. ✅ Admin remarks displayed
5. ✅ "Resubmit" button available

## 🚀 Deployment Checklist

- [x] Backend API returns KYC status in profile
- [x] KYC middleware protects sensitive endpoints
- [x] Product inquiry requires KYC
- [x] Quotations require KYC
- [x] Orders require KYC
- [x] Dashboard shows KYC widget
- [x] Widget updates based on status
- [x] Features lock/unlock automatically
- [x] Clear error messages for blocked access
- [x] Resubmission flow for rejected KYC

## 📞 Support

### Common Issues:

**Q: Widget not showing on dashboard?**
A: Check that `kyc-widget.js` is loaded and user is authenticated.

**Q: Features still accessible without KYC?**
A: Verify `requireKYC` middleware is added to route.

**Q: Widget not disappearing after approval?**
A: Check that KYC status is being updated in database and profile API returns `APPROVED`.

**Q: How to add KYC requirement to new feature?**
A: Add `requireKYC` middleware to the route:
```javascript
router.post('/new-feature', requireAuth, requireKYC, asyncHandler(ctrl.action));
```

## 🎉 Success!

Your platform now has complete customer-side KYC enforcement:
- ✅ Users must complete KYC to access key features
- ✅ Dashboard shows clear status and next steps
- ✅ Approved KYC = Full access (widget disappears)
- ✅ Rejected KYC = Can resubmit with guidance
- ✅ API-level protection prevents bypassing
- ✅ User-friendly experience with clear messaging

Start your server and test the complete flow!
```cmd
npm run dev
```

Then visit:
- Customer Dashboard: `http://localhost:4000/dashboard.html`
- KYC Submission: `http://localhost:4000/kyc-enhanced.html`
- Admin Review: `http://localhost:4000/admin.html` → KYC Review tab
