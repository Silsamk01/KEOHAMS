# Enhanced KYC System - Quick Reference

## 🚀 Installation (30 seconds)

```bash
# 1. Navigate to backend
cd backend

# 2. Install dependencies
npm install tesseract.js @vladmandic/face-api canvas

# 3. Run migration
npm run migrate

# 4. Add to .env
echo KYC_ENCRYPTION_KEY=your-secret-key-min-32-chars >> .env

# 5. Download models (manual step)
# Visit: https://github.com/vladmandic/face-api/tree/master/model
# Download 4 model folders to: backend/models/face-api/
```

## 📁 File Structure

```
backend/
├── src/
│   ├── migrations/
│   │   └── 20251017_024_enhanced_kyc_system.js   ← NEW: DB schema
│   ├── services/
│   │   ├── ocrService.js                         ← NEW: OCR processing
│   │   ├── faceMatchService.js                   ← NEW: Face matching
│   │   └── encryptionService.js                  ← NEW: Encryption
│   ├── controllers/
│   │   └── enhancedKYCController.js              ← NEW: KYC logic
│   └── routes/
│       └── enhancedKYC.js                        ← NEW: API routes
├── models/
│   └── face-api/                                 ← REQUIRED: Download models here
│       ├── ssdMobilenetv1/
│       ├── faceLandmark68Net/
│       ├── faceRecognitionNet/
│       └── faceExpressionNet/
└── uploads/
    └── kyc/                                      ← AUTO-CREATED: Document storage

frontend/
├── pages/
│   ├── kyc-enhanced.html                         ← NEW: User upload form
│   └── admin.html                                ← MODIFIED: Added KYC Review tab
└── src/
    └── js/
        ├── kyc-enhanced.js                       ← NEW: Form logic
        └── admin-kyc-review.js                   ← NEW: Admin dashboard
```

## 🌐 API Endpoints

### User Endpoints:
```
POST /api/kyc/enhanced/upload           # Upload 3 documents
GET  /api/kyc/enhanced/status           # Get submission status
```

### Admin Endpoints:
```
GET  /api/kyc/enhanced/admin/list                    # List all
GET  /api/kyc/enhanced/admin/:id                     # Get detail
POST /api/kyc/enhanced/admin/:id/review              # Approve/Reject
GET  /api/kyc/enhanced/admin/:id/document/:docType   # View document
```

## 🗄️ Database Tables

```sql
kyc_submissions         ← Extended with 20+ new fields
kyc_audit_log          ← NEW: Audit trail
kyc_face_matches       ← NEW: Face comparison data
kyc_ocr_results        ← NEW: OCR extraction data
```

## 🎯 User Flow (Visual)

```
User → kyc-enhanced.html
  ↓
Upload 3 Documents
  ├─ Government ID
  ├─ Live Selfie
  └─ Address Proof
  ↓
Background Processing
  ├─ OCR Extraction
  ├─ Face Matching
  ├─ Liveness Check
  └─ Validation
  ↓
Auto-Decision
  ├─ APPROVED (all checks pass)
  ├─ REJECTED (expired doc)
  └─ UNDER_REVIEW (low confidence)
  ↓
Admin Review (if needed)
  ↓
Final Decision
```

## 🔐 Security Checklist

- [x] AES-256-GCM encryption
- [x] PBKDF2 key derivation
- [x] File validation (type/size)
- [x] Authentication required
- [x] Admin-only review
- [x] Audit logging
- [x] GDPR consent
- [ ] Rate limiting (TODO)
- [ ] CAPTCHA (TODO)
- [ ] Cloud storage (TODO)

## ⚡ Quick Test

```bash
# 1. Start server
npm run dev

# 2. Test user upload
http://localhost:4000/kyc-enhanced.html

# 3. Test admin review
http://localhost:4000/admin.html → KYC Review tab

# 4. Check audit logs
SELECT * FROM kyc_audit_log ORDER BY created_at DESC;

# 5. Verify encryption
ls backend/uploads/kyc/*.enc
```

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| OCR fails | Check tesseract.js installation |
| Face matching errors | Download all 4 model folders |
| Encryption errors | Set `KYC_ENCRYPTION_KEY` in .env |
| High CPU usage | Use background job queue |
| Canvas build errors | Install Python 3 + build tools |

## 📊 Status Workflow

```
PENDING → OCR + Face Match → Auto-Decision
                                  ↓
                    ┌─────────────┼─────────────┐
                    ↓             ↓             ↓
                APPROVED    UNDER_REVIEW    REJECTED
                    ↓             ↓             ↓
                  DONE     Admin Review    Resubmit
                                ↓
                          APPROVED/REJECTED
```

## 🎨 Admin Actions

1. **Approve** → User gets full access, verification_states updated
2. **Reject** → User notified with remarks
3. **Request Resubmit** → User can upload new documents

## 📱 Pages & Routes

```
User Side:
  /kyc-enhanced.html              → Upload form
  
Admin Side:
  /admin.html → KYC Review Tab    → Review dashboard
```

## 🔑 Environment Variables

```env
# Required
KYC_ENCRYPTION_KEY=your-very-long-secret-key-min-32-characters

# Optional (falls back to JWT_SECRET if not set)
# But recommended to use separate key for KYC documents
```

## 📈 Performance Metrics

- **Upload Time:** Instant (async processing)
- **OCR Processing:** ~5-15 seconds per document
- **Face Matching:** ~2-5 seconds
- **Total Processing:** ~20-30 seconds
- **Encryption Overhead:** <1 second per file

## 🎓 Tech Stack

```
Backend:  Node.js, Express, Tesseract.js, face-api.js, Canvas, Crypto
Frontend: Vanilla JS, Bootstrap 5, Font Awesome
Database: MySQL (Knex.js migrations)
Storage:  Local filesystem (encrypted) → Recommended: S3/Azure
```

## ✅ Compliance

- **GDPR:** ✅ Explicit consent, encrypted storage, audit trail
- **NDPR:** ✅ Lawful processing, security measures, consent

## 📞 Support

- **Documentation:** `KYC_SYSTEM_DOCUMENTATION.md`
- **Summary:** `KYC_SYSTEM_SUMMARY.md`
- **Quick Ref:** This file

---

**Ready to go! 🚀**

Just install dependencies, download models, and run migration.

Total setup time: ~10 minutes (excluding model download)
