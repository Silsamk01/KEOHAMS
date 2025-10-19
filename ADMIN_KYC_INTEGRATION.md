# Admin Dashboard KYC Integration - Manual Steps

## What's Already Done ✅
1. KYC tab button added to sidebar (line 41-43 in admin.html)
2. Badge notification system ready (`kycPendingBadge`)
3. JavaScript file created: `frontend/src/js/admin-kyc-review.js`

## What's Missing ❌

### 1. Add the KYC Review Pane Content
**Location**: `frontend/pages/admin.html` - Insert after line 114 (after `pane-users` closes, before `pane-categories` starts)

```html
      <!-- KYC Review Tab Pane -->
      <div class="tab-pane fade" id="pane-kyc-review" role="tabpanel">
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">KYC Submissions Review</h5>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary" id="kycFilterAll">All</button>
              <button class="btn btn-outline-warning active" id="kycFilterPending">Pending</button>
              <button class="btn btn-outline-success" id="kycFilterApproved">Approved</button>
              <button class="btn btn-outline-danger" id="kycFilterRejected">Rejected</button>
            </div>
          </div>
          <div class="card-body">
            <div class="table-responsive">
              <table class="table table-hover align-middle">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th>Auto Decision</th>
                    <th>Similarity</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="kycSubmissionsList">
                  <tr>
                    <td colspan="7" class="text-center text-muted">
                      <div class="spinner-border spinner-border-sm me-2"></div>
                      Loading submissions...
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
```

### 2. Include the KYC Review JavaScript
**Location**: `frontend/pages/admin.html` - Line 640 (before `</body>`)

Add this line:
```html
  <script type="module" src="/src/js/admin-kyc-review.js"></script>
```

So it looks like:
```html
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script type="module" src="/src/js/admin.js"></script>
  <script type="module" src="/src/js/admin-kyc-review.js"></script>
</body>
</html>
```

## Testing the Integration

1. Start your server:
   ```cmd
   cd C:\Users\user\Desktop\KEOHAMS\backend
   npm run dev
   ```

2. Navigate to: `http://localhost:4000/admin.html`

3. Click on the "KYC Review" tab

4. You should see:
   - List of KYC submissions
   - Filter buttons (All, Pending, Approved, Rejected)
   - Pending badge with count
   - Ability to view, approve, or reject submissions

## Features Available:
- ✅ View all KYC submissions
- ✅ Filter by status
- ✅ View document images (Government ID, Selfie, Address Proof)
- ✅ See OCR extracted data
- ✅ See face matching results (currently mock data)
- ✅ Approve/Reject submissions with remarks
- ✅ Audit trail logging
- ✅ Real-time badge notifications

## Files Modified:
1. `backend/src/app.js` - Added KYC routes
2. `frontend/pages/admin.html` - Added KYC tab button (needs pane content + script)
3. `frontend/src/js/admin-kyc-review.js` - Complete KYC review logic

## Note:
Face matching is currently returning MOCK results due to TensorFlow.js compatibility with Node.js v22.
To enable real face matching, either:
- Downgrade to Node.js v18 LTS
- Implement client-side face matching
- Wait for TensorFlow.js Node.js v22 support
