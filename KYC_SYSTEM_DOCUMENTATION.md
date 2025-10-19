# Enhanced KYC Verification System Documentation

## Overview

A comprehensive, secure KYC (Know Your Customer) verification system with OCR, face matching, liveness detection, and encrypted document storage.

---

## Features

### ✅ **Document Upload & Validation**
- **3 Required Documents:**
  1. Government-issued ID (National ID, Driver's License, Passport)
  2. Live Photo/Selfie (for face verification & liveness detection)
  3. Proof of Address (Utility bill, Bank statement - max 3 months old)

- **File Validation:**
  - Formats: JPG, PNG, PDF
  - Max size: 10MB per file
  - Real-time preview before upload
  - Drag-and-drop support

### 🔐 **Security & Encryption**
- AES-256-GCM encryption for stored documents
- Secure key derivation (PBKDF2 with 100,000 iterations)
- Documents encrypted at rest
- Secure deletion with 3-pass overwrite
- GDPR/NDPR compliant data handling

### 🤖 **Automated Verification**

#### **1. OCR (Optical Character Recognition)**
- Extracts text from government IDs
- Parses structured data (name, ID number, DOB, expiry)
- Validates document expiry automatically
- Confidence scoring (0-100%)
- Requires manual review if confidence < 70%

#### **2. Face Matching**
- Compares ID photo with live selfie
- Similarity score (0-100%)
- Match threshold: > 60% = Match
- Face landmark detection
- Expression analysis

#### **3. Liveness Detection**
- Prevents photo spoofing
- Checks for:
  - Single face presence
  - Face size validation
  - Natural expressions
  - Detection quality

### 📊 **Admin Review Dashboard**
- Side-by-side document viewing
- OCR extracted data display
- Face match scores & liveness results
- Complete audit trail
- Approve / Reject / Request Resubmit actions
- Add custom remarks

### 📝 **Audit Logging**
- Every action logged with timestamp
- Tracks: Submissions, OCR processing, face verification, admin reviews
- Immutable audit trail
- Compliance-ready reports

---

## Database Schema

### **Tables Created**

#### 1. `kyc_submissions` (Extended)
```sql
-- New fields added:
id_type ENUM('NATIONAL_ID', 'DRIVERS_LICENSE', 'PASSPORT', 'OTHER')
id_number VARCHAR(100)
id_issue_date DATE
id_expiry_date DATE
id_document_path VARCHAR(500)
live_photo_path VARCHAR(500)
face_match_score DECIMAL(5,2)
face_match_status ENUM('PENDING', 'MATCHED', 'NOT_MATCHED', 'ERROR')
liveness_check_passed BOOLEAN
address_proof_type ENUM('UTILITY_BILL', 'BANK_STATEMENT', 'RENTAL_AGREEMENT', 'OTHER')
address_proof_path VARCHAR(500)
address_proof_date DATE
residential_address TEXT
ocr_data JSON
ocr_confidence DECIMAL(5,2)
ocr_status ENUM('PENDING', 'SUCCESS', 'FAILED', 'MANUAL_REVIEW')
document_expired BOOLEAN
admin_remarks TEXT
reviewed_by INT (FK to users)
reviewed_at TIMESTAMP
is_encrypted BOOLEAN
encryption_key_id VARCHAR(100)
gdpr_consent BOOLEAN
```

#### 2. `kyc_audit_log` (New)
```sql
id INT PRIMARY KEY AUTO_INCREMENT
kyc_submission_id INT (FK)
user_id INT (FK)
admin_id INT (FK, nullable)
action ENUM('SUBMITTED', 'DOCUMENT_UPLOADED', 'OCR_PROCESSED', 'FACE_VERIFIED', 'ADMIN_REVIEWED', 'APPROVED', 'REJECTED', 'RESUBMIT_REQUESTED', 'DOCUMENT_EXPIRED', 'DATA_DELETED')
status_before ENUM
status_after ENUM
remarks TEXT
metadata JSON
created_at TIMESTAMP
```

#### 3. `kyc_face_matches` (New)
```sql
id INT PRIMARY KEY AUTO_INCREMENT
kyc_submission_id INT (FK)
id_face_path VARCHAR(500)
selfie_face_path VARCHAR(500)
similarity_score DECIMAL(5,2)
face_landmarks JSON
liveness_passed BOOLEAN
liveness_checks JSON
match_status ENUM('MATCHED', 'NOT_MATCHED', 'UNCERTAIN', 'ERROR')
processed_at TIMESTAMP
```

#### 4. `kyc_ocr_results` (New)
```sql
id INT PRIMARY KEY AUTO_INCREMENT
kyc_submission_id INT (FK)
document_type ENUM('ID', 'ADDRESS_PROOF')
extracted_text JSON
parsed_fields JSON
confidence_score DECIMAL(5,2)
requires_manual_review BOOLEAN
processed_at TIMESTAMP
```

---

## API Endpoints

### **User Endpoints**

#### `POST /api/kyc/enhanced/upload`
Upload KYC documents

**Request:**
- Content-Type: `multipart/form-data`
- Files:
  - `id_document` (required)
  - `live_photo` (required)
  - `address_proof` (required)
- Fields:
  - `id_type` (required)
  - `id_number` (required)
  - `id_issue_date` (optional)
  - `id_expiry_date` (optional)
  - `residential_address` (required)
  - `address_proof_type` (required)
  - `address_proof_date` (required)
  - `gdpr_consent` (required: true)

**Response:**
```json
{
  "message": "KYC documents uploaded successfully. Processing started.",
  "submissionId": 123,
  "status": "PENDING"
}
```

#### `GET /api/kyc/enhanced/status`
Get current user's KYC submission status

**Response:**
```json
{
  "status": "UNDER_REVIEW",
  "submission": {
    "id": 123,
    "status": "UNDER_REVIEW",
    "id_type": "NATIONAL_ID",
    "face_match_score": 87.5,
    "liveness_check_passed": true,
    "ocr_status": "SUCCESS",
    "document_expired": false,
    "admin_remarks": null,
    "created_at": "2025-10-17T10:30:00Z"
  }
}
```

### **Admin Endpoints**

#### `GET /api/kyc/enhanced/admin/list?status={status}&page={page}&pageSize={pageSize}&search={search}`
List all KYC submissions

**Response:**
```json
{
  "data": [...],
  "total": 50,
  "page": 1,
  "pageSize": 20
}
```

#### `GET /api/kyc/enhanced/admin/:id`
Get detailed KYC submission

**Response:**
```json
{
  "submission": {...},
  "ocrResults": [...],
  "faceMatch": {...},
  "auditLog": [...]
}
```

#### `POST /api/kyc/enhanced/admin/:id/review`
Approve or reject KYC

**Request:**
```json
{
  "action": "APPROVE", // or "REJECT", "REQUEST_RESUBMIT"
  "remarks": "All documents verified"
}
```

#### `GET /api/kyc/enhanced/admin/:id/document/:docType`
View document (encrypted documents are decrypted on-the-fly)

**Params:**
- `docType`: `id` | `selfie` | `address`

---

## Installation & Setup

### **1. Install Dependencies**

```bash
cd backend
npm install tesseract.js @vladmandic/face-api canvas
```

### **2. Download Face-API Models**

```bash
# Create models directory
mkdir -p backend/models/face-api

# Download models (replace with actual download script)
# Models needed:
# - ssdMobilenetv1
# - faceLandmark68Net
# - faceRecognitionNet
# - faceExpressionNet
```

Download from: https://github.com/vladmandic/face-api/tree/master/model

### **3. Environment Variables**

Add to `backend/.env`:
```env
# KYC Encryption Key (generate a strong random key)
KYC_ENCRYPTION_KEY=your-very-long-secret-encryption-key-here

# Optional: Fallback to JWT_SECRET if not set
```

### **4. Run Migration**

```bash
cd backend
npm run migrate
```

### **5. Create KYC Uploads Directory**

```bash
mkdir -p backend/uploads/kyc
```

---

## User Flow

1. **User navigates to `/kyc-enhanced.html`**
2. **Fills personal information** (ID type, number, address)
3. **Uploads 3 documents** with real-time preview
4. **Optionally uses webcam** to capture live selfie
5. **Accepts GDPR consent**
6. **Submits form** (with progress tracking)
7. **Background processing starts:**
   - OCR extracts ID data
   - Face matching compares ID vs selfie
   - Liveness detection runs on selfie
   - Address proof validated for recency
8. **Auto-decision logic:**
   - If all checks pass with high confidence → `APPROVED`
   - If document expired → `REJECTED`
   - If face match fails or low OCR confidence → `UNDER_REVIEW`
9. **Admin reviews** (if required)
10. **User receives notification** of final decision

---

## Admin Review Workflow

1. **Admin opens KYC Review tab** in admin dashboard
2. **Filters by status** (Pending, Under Review, etc.)
3. **Clicks "Review"** on a submission
4. **Modal opens with:**
   - Side-by-side document images
   - OCR extracted data
   - Face match score & liveness results
   - Audit log
5. **Admin reviews documents visually**
6. **Admin takes action:**
   - **Approve** → User gets full access
   - **Reject** → User notified with remarks
   - **Request Resubmit** → User can upload new documents
7. **Action logged in audit trail**

---

## Security Best Practices

### **✅ Implemented**
- ✅ AES-256-GCM encryption
- ✅ PBKDF2 key derivation
- ✅ File validation (type, size)
- ✅ GDPR consent collection
- ✅ Audit logging
- ✅ Secure file deletion
- ✅ Authentication required for all endpoints
- ✅ Admin-only review endpoints

### **⚠️ Recommended Additional Measures**
- Store encrypted documents on S3/cloud storage (not local filesystem)
- Implement rate limiting on upload endpoint
- Add CAPTCHA to prevent automated submissions
- Set up data retention policy (auto-delete after X years)
- Implement role-based access (separate REVIEWER role)
- Add email notifications for status changes
- Enable multi-factor authentication for admins
- Regular security audits
- Penetration testing
- SIEM integration for audit log monitoring

---

## Compliance

### **GDPR Compliance**
- ✅ Explicit consent collected
- ✅ Purpose of data processing disclosed
- ✅ Data encrypted at rest
- ✅ Audit trail of all data access
- ✅ Right to deletion (secure delete function available)
- ✅ Data minimization (only required fields collected)

### **NDPR Compliance (Nigeria)**
- ✅ Data processing lawful and transparent
- ✅ Security measures implemented
- ✅ Consent obtained before processing
- ✅ Data subject rights respected

---

## Troubleshooting

### **OCR Not Working**
- Ensure Tesseract.js is installed
- Check image quality (min 300 DPI recommended)
- Verify supported languages are loaded

### **Face Matching Fails**
- Download all required face-api.js models
- Check lighting in photos
- Ensure faces are clearly visible
- Verify canvas package is installed

### **Encryption Errors**
- Set `KYC_ENCRYPTION_KEY` environment variable
- Ensure key is at least 32 characters
- Check file permissions on uploads directory

### **High Server Load**
- OCR and face matching are CPU-intensive
- Consider offloading to background job queue (BullMQ)
- Scale horizontally with multiple workers
- Use GPU acceleration for face-api.js if available

---

## Performance Optimization

1. **Background Processing:**
   - OCR and face matching run asynchronously
   - User doesn't wait for processing to complete

2. **Worker Pool:**
   - Tesseract workers are pooled (default: 2)
   - Adjust `MAX_WORKERS` in `ocrService.js` based on CPU cores

3. **Caching:**
   - Face-API models loaded once at startup
   - Reused across all requests

4. **Image Optimization:**
   - Resize large images before processing
   - Compress to reduce storage

---

## Testing

### **Manual Testing Steps**

1. **Valid Submission Test:**
   - Upload clear ID, selfie, recent utility bill
   - Verify auto-approval if all checks pass

2. **Expired Document Test:**
   - Upload ID with past expiry date
   - Verify auto-rejection

3. **Face Mismatch Test:**
   - Upload different person's ID and selfie
   - Verify requires manual review

4. **Old Address Proof Test:**
   - Upload utility bill > 3 months old
   - Verify flagged for review

5. **Low Quality Image Test:**
   - Upload blurry or low-res images
   - Verify OCR requires manual review

---

## Future Enhancements

- [ ] Real-time video liveness detection
- [ ] Integration with third-party ID verification APIs
- [ ] Biometric fingerprint verification
- [ ] Blockchain-based audit trail
- [ ] Multi-language OCR support
- [ ] Auto-translation of documents
- [ ] Risk scoring system
- [ ] Sanctions list checking
- [ ] PEP (Politically Exposed Persons) screening
- [ ] Document forgery detection using AI

---

## Support

For issues or questions, contact the development team or refer to the main KEOHAMS documentation.

---

**Last Updated:** October 17, 2025
