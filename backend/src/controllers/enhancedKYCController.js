/**
 * Enhanced KYC Controller with OCR, Face Matching, and Document Encryption
 */
const db = require('../config/db');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');
const ocrService = require('../services/ocrService');
const faceMatchService = require('../services/faceMatchService');
const encryptionService = require('../services/encryptionService');

/**
 * Log KYC audit event
 */
async function logAudit(kycSubmissionId, userId, adminId, action, statusBefore, statusAfter, remarks, metadata = {}) {
  try {
    await db('kyc_audit_log').insert({
      kyc_submission_id: kycSubmissionId,
      user_id: userId,
      admin_id: adminId || null,
      action,
      status_before: statusBefore,
      status_after: statusAfter,
      remarks,
      metadata: JSON.stringify(metadata)
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to log KYC audit');
  }
}

/**
 * Upload and process KYC documents (enhanced version)
 * Handles: Government ID, Live Photo/Selfie, Address Proof
 */
exports.uploadKYCDocuments = async (req, res) => {
  try {
    const userId = req.user.sub;
    const {
      id_type,
      id_number,
      id_issue_date,
      id_expiry_date,
      residential_address,
      address_proof_type,
      address_proof_date,
      gdpr_consent
    } = req.body;

    // Validate GDPR consent
    if (gdpr_consent !== 'true' && gdpr_consent !== true) {
      return res.status(400).json({ message: 'GDPR/NDPR consent required' });
    }

    // Check for uploaded files
    if (!req.files) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const { id_document, live_photo, address_proof } = req.files;

    if (!id_document || !live_photo || !address_proof) {
      return res.status(400).json({
        message: 'All three documents required: Government ID, Live Photo, Address Proof'
      });
    }

    // Validate file types
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    const files = [id_document[0], live_photo[0], address_proof[0]];
    
    for (const file of files) {
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          message: `Invalid file type for ${file.fieldname}. Allowed: JPG, PNG, PDF`
        });
      }
    }

    // Check if user already has a pending submission
    const existing = await db('kyc_submissions')
      .where({ user_id: userId })
      .whereIn('status', ['PENDING', 'UNDER_REVIEW'])
      .first();

    if (existing) {
      return res.status(400).json({
        message: 'You already have a pending KYC submission under review'
      });
    }

    // Create KYC submission record
    const [submissionId] = await db('kyc_submissions').insert({
      user_id: userId,
      id_type,
      id_number,
      id_issue_date: id_issue_date || null,
      id_expiry_date: id_expiry_date || null,
      id_document_path: `/uploads/kyc/${id_document[0].filename}`,
      live_photo_path: `/uploads/kyc/${live_photo[0].filename}`,
      address_proof_type,
      address_proof_path: `/uploads/kyc/${address_proof[0].filename}`,
      address_proof_date: address_proof_date || null,
      residential_address,
      gdpr_consent: true,
      status: 'PENDING',
      face_match_status: 'PENDING',
      ocr_status: 'PENDING'
    });

    // Log audit event
    await logAudit(submissionId, userId, null, 'SUBMITTED', null, 'PENDING', 'KYC documents uploaded', {
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Start background processing (OCR + Face Matching)
    processKYCDocuments(submissionId, userId, {
      idDocumentPath: id_document[0].path,
      livePhotoPath: live_photo[0].path,
      addressProofPath: address_proof[0].path,
      idType: id_type
    }).catch(err => {
      logger.error({ err, submissionId }, 'Background KYC processing failed');
    });

    res.status(201).json({
      message: 'KYC documents uploaded successfully. Processing started.',
      submissionId,
      status: 'PENDING'
    });
  } catch (error) {
    logger.error({ err: error }, 'KYC upload failed');
    res.status(500).json({ message: 'Failed to upload KYC documents' });
  }
};

/**
 * Background processing: OCR + Face Matching + Validation
 */
async function processKYCDocuments(submissionId, userId, files) {
  try {
    logger.info({ submissionId, userId }, 'Starting background KYC processing');

    // 1. OCR Processing on Government ID
    let ocrResult = null;
    try {
      ocrResult = await ocrService.processKYCDocument(
        files.idDocumentPath,
        'ID',
        files.idType
      );

      if (ocrResult.success) {
        // Save OCR results
        await db('kyc_ocr_results').insert({
          kyc_submission_id: submissionId,
          document_type: 'ID',
          extracted_text: JSON.stringify(ocrResult.ocrData.rawText),
          parsed_fields: JSON.stringify(ocrResult.parsedData),
          confidence_score: ocrResult.ocrData.confidence,
          requires_manual_review: ocrResult.requiresManualReview
        });

        // Update KYC submission with OCR data
        await db('kyc_submissions').where({ id: submissionId }).update({
          ocr_data: JSON.stringify(ocrResult.parsedData),
          ocr_confidence: ocrResult.ocrData.confidence,
          ocr_status: ocrResult.requiresManualReview ? 'MANUAL_REVIEW' : 'SUCCESS',
          document_expired: ocrResult.validationResults?.expiryCheck?.expired || false
        });

        await logAudit(submissionId, userId, null, 'OCR_PROCESSED', 'PENDING', 'PENDING', 
          `OCR confidence: ${ocrResult.ocrData.confidence}%`);
      }
    } catch (ocrError) {
      logger.error({ err: ocrError, submissionId }, 'OCR processing failed');
      await db('kyc_submissions').where({ id: submissionId }).update({ ocr_status: 'FAILED' });
    }

    // 2. OCR Processing on Address Proof
    try {
      const addressOcrResult = await ocrService.processKYCDocument(
        files.addressProofPath,
        'ADDRESS_PROOF'
      );

      if (addressOcrResult.success) {
        await db('kyc_ocr_results').insert({
          kyc_submission_id: submissionId,
          document_type: 'ADDRESS_PROOF',
          extracted_text: JSON.stringify(addressOcrResult.ocrData.rawText),
          parsed_fields: JSON.stringify(addressOcrResult.parsedData),
          confidence_score: addressOcrResult.ocrData.confidence,
          requires_manual_review: addressOcrResult.requiresManualReview
        });
      }
    } catch (addressOcrError) {
      logger.error({ err: addressOcrError, submissionId }, 'Address proof OCR failed');
    }

    // 3. Face Matching
    let faceMatchResult = null;
    try {
      faceMatchResult = await faceMatchService.verifyKYCFaces(
        files.idDocumentPath,
        files.livePhotoPath,
        { extractFaces: true }
      );

      if (faceMatchResult.success) {
        // Save face match results
        await db('kyc_face_matches').insert({
          kyc_submission_id: submissionId,
          id_face_path: faceMatchResult.extractedFaces?.idFacePath || null,
          selfie_face_path: faceMatchResult.extractedFaces?.selfieFacePath || null,
          similarity_score: faceMatchResult.similarity,
          face_landmarks: JSON.stringify({
            idFace: faceMatchResult.idFace,
            selfieFace: faceMatchResult.selfieFace
          }),
          liveness_passed: faceMatchResult.livenessPassed,
          liveness_checks: JSON.stringify(faceMatchResult.livenessChecks),
          match_status: faceMatchResult.matched ? 'MATCHED' : 'NOT_MATCHED'
        });

        // Update KYC submission
        await db('kyc_submissions').where({ id: submissionId }).update({
          face_match_score: faceMatchResult.similarity,
          face_match_status: faceMatchResult.matched ? 'MATCHED' : 'NOT_MATCHED',
          liveness_check_passed: faceMatchResult.livenessPassed
        });

        await logAudit(submissionId, userId, null, 'FACE_VERIFIED', 'PENDING', 'PENDING',
          `Face match: ${faceMatchResult.similarity}%, Liveness: ${faceMatchResult.livenessPassed}`);
      }
    } catch (faceError) {
      logger.error({ err: faceError, submissionId }, 'Face matching failed');
      await db('kyc_submissions').where({ id: submissionId }).update({
        face_match_status: 'ERROR'
      });
    }

    // 4. Auto-decision logic
    let autoStatus = 'UNDER_REVIEW';
    let autoRemarks = [];

    if (ocrResult?.success && faceMatchResult?.success) {
      // Check expiry
      if (ocrResult.validationResults?.expiryCheck?.expired) {
        autoStatus = 'REJECTED';
        autoRemarks.push('Document has expired');
      }
      // Check face match
      else if (!faceMatchResult.matched) {
        autoStatus = 'UNDER_REVIEW';
        autoRemarks.push('Face match failed - requires manual review');
      }
      // Check liveness
      else if (!faceMatchResult.livenessPassed) {
        autoStatus = 'UNDER_REVIEW';
        autoRemarks.push('Liveness check failed - requires manual review');
      }
      // Check OCR confidence
      else if (ocrResult.requiresManualReview) {
        autoStatus = 'UNDER_REVIEW';
        autoRemarks.push('Low OCR confidence - requires manual review');
      }
      // All checks passed
      else if (faceMatchResult.matched && faceMatchResult.livenessPassed && !ocrResult.requiresManualReview) {
        // Can auto-approve if confidence is very high
        if (faceMatchResult.similarity >= 80 && ocrResult.ocrData.confidence >= 85) {
          autoStatus = 'APPROVED';
          autoRemarks.push('All automated checks passed');
        } else {
          autoStatus = 'UNDER_REVIEW';
          autoRemarks.push('Good results but requires manual review');
        }
      }
    }

    // Update status
    await db('kyc_submissions').where({ id: submissionId }).update({
      status: autoStatus
    });

    await logAudit(submissionId, userId, null, 'AUTO_PROCESSED', 'PENDING', autoStatus,
      autoRemarks.join('; '));

    logger.info({ submissionId, autoStatus }, 'KYC background processing completed');

  } catch (error) {
    logger.error({ err: error, submissionId }, 'Background KYC processing failed');
    await db('kyc_submissions').where({ id: submissionId }).update({
      status: 'UNDER_REVIEW'
    });
  }
}

/**
 * Get user's KYC submission status
 */
exports.getKYCStatus = async (req, res) => {
  try {
    const userId = req.user.sub;

    const submission = await db('kyc_submissions')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .first();

    if (!submission) {
      return res.json({ status: 'NOT_SUBMITTED', submission: null });
    }

    // Don't expose sensitive paths
    const safeSubmission = {
      id: submission.id,
      status: submission.status,
      id_type: submission.id_type,
      face_match_status: submission.face_match_status,
      face_match_score: submission.face_match_score,
      liveness_check_passed: submission.liveness_check_passed,
      ocr_status: submission.ocr_status,
      document_expired: submission.document_expired,
      admin_remarks: submission.admin_remarks,
      reviewed_at: submission.reviewed_at,
      created_at: submission.created_at,
      updated_at: submission.updated_at
    };

    res.json({ status: submission.status, submission: safeSubmission });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get KYC status');
    res.status(500).json({ message: 'Failed to retrieve KYC status' });
  }
};

/**
 * ADMIN: Get all KYC submissions with filters
 */
exports.adminListKYC = async (req, res) => {
  try {
    const { status, page = 1, pageSize = 20, search } = req.query;

    let query = db('kyc_submissions as k')
      .leftJoin('users as u', 'k.user_id', 'u.id')
      .select(
        'k.*',
        'u.name as user_name',
        'u.email as user_email'
      )
      .orderBy('k.created_at', 'desc');

    if (status) {
      query = query.where('k.status', status);
    }

    if (search) {
      query = query.where(function() {
        this.where('u.name', 'like', `%${search}%`)
          .orWhere('u.email', 'like', `%${search}%`)
          .orWhere('k.id_number', 'like', `%${search}%`);
      });
    }

    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const data = await query.clone().offset(offset).limit(parseInt(pageSize));

    const [{ count }] = await query.clone().count({ count: '*' });

    res.json({
      data,
      total: parseInt(count),
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to list KYC submissions');
    res.status(500).json({ message: 'Failed to retrieve KYC submissions' });
  }
};

/**
 * ADMIN: Get detailed KYC submission with all data
 */
exports.adminGetKYCDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const submission = await db('kyc_submissions as k')
      .leftJoin('users as u', 'k.user_id', 'u.id')
      .select(
        'k.*',
        'u.name as user_name',
        'u.email as user_email',
        'u.phone as user_phone',
        'u.dob as user_dob'
      )
      .where('k.id', id)
      .first();

    if (!submission) {
      return res.status(404).json({ message: 'KYC submission not found' });
    }

    // Get OCR results
    const ocrResults = await db('kyc_ocr_results')
      .where({ kyc_submission_id: id });

    // Get face match results
    const faceMatch = await db('kyc_face_matches')
      .where({ kyc_submission_id: id })
      .first();

    // Get audit log
    const auditLog = await db('kyc_audit_log as kal')
      .leftJoin('users as u', 'kal.admin_id', 'u.id')
      .select('kal.*', 'u.name as admin_name')
      .where({ kyc_submission_id: id })
      .orderBy('kal.created_at', 'desc');

    res.json({
      submission,
      ocrResults,
      faceMatch,
      auditLog
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get KYC detail');
    res.status(500).json({ message: 'Failed to retrieve KYC detail' });
  }
};

/**
 * ADMIN: Approve or Reject KYC submission
 */
exports.adminReviewKYC = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, remarks } = req.body; // action: 'APPROVE' or 'REJECT'
    const adminId = req.user.sub;

    if (!['APPROVE', 'REJECT', 'REQUEST_RESUBMIT'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action' });
    }

    const submission = await db('kyc_submissions').where({ id }).first();

    if (!submission) {
      return res.status(404).json({ message: 'KYC submission not found' });
    }

    const newStatus = action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'RESUBMIT_REQUIRED';

    await db('kyc_submissions').where({ id }).update({
      status: newStatus,
      admin_remarks: remarks || null,
      reviewed_by: adminId,
      reviewed_at: db.fn.now()
    });

    // Update user_verification_state table (upsert)
    if (action === 'APPROVE') {
      const state = await db('user_verification_state').where({ user_id: submission.user_id }).first();
      if (state) {
        await db('user_verification_state').where({ user_id: submission.user_id }).update({
          status: 'KYC_VERIFIED',
          kyc_submission_id: submission.id,
          kyc_verified_at: db.fn.now(),
          updated_at: db.fn.now()
        });
      } else {
        await db('user_verification_state').insert({
          user_id: submission.user_id,
          status: 'KYC_VERIFIED',
          kyc_submission_id: submission.id,
          kyc_verified_at: db.fn.now(),
          risk_score: 0,
          risk_level: 'LOW',
          manual_lock: false
        });
      }
      // Log a risk event for audit
      try {
        const st = await db('user_verification_state').where({ user_id: submission.user_id }).first();
        await db('risk_events').insert({
          user_id: submission.user_id,
          event_type: 'KYC_APPROVED',
          delta: -10,
          resulting_score: st?.risk_score ?? 0,
          resulting_level: st?.risk_level || 'LOW',
          metadata: JSON.stringify({ submission_id: submission.id, admin_id: adminId })
        });
      } catch (_e) { /* non-fatal */ }
    }

    // Log audit
    await logAudit(id, submission.user_id, adminId, 
      action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'RESUBMIT_REQUESTED',
      submission.status, newStatus, remarks || '');

    // TODO: Send notification/email to user

    res.json({
      message: `KYC submission ${action.toLowerCase()}d successfully`,
      status: newStatus
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to review KYC');
    res.status(500).json({ message: 'Failed to process KYC review' });
  }
};

/**
 * ADMIN: View KYC document (handles encrypted documents)
 */
exports.adminViewDocument = async (req, res) => {
  try {
    const { id, docType } = req.params; // docType: 'id', 'selfie', 'address'

    const submission = await db('kyc_submissions').where({ id }).first();

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    let docPath;
    switch (docType) {
      case 'id':
        docPath = submission.id_document_path;
        break;
      case 'selfie':
        docPath = submission.live_photo_path;
        break;
      case 'address':
        docPath = submission.address_proof_path;
        break;
      default:
        return res.status(400).json({ message: 'Invalid document type' });
    }

    if (!docPath) {
      return res.status(404).json({ message: 'Document not found' });
    }

  // Build absolute path safely even if stored path begins with a leading slash
  const safeRelPath = docPath.replace(/^[\\/]+/, '');
  const fullPath = path.join(__dirname, '../..', safeRelPath);

    // Check if encrypted
    const isEnc = await encryptionService.isEncrypted(fullPath);

    if (isEnc) {
      const decryptedBuffer = await encryptionService.getDecryptedDocument(fullPath);
      // Infer content type from extension
      const ext = path.extname(fullPath).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' : ext === '.pdf' ? 'application/pdf' : 'image/jpeg';
      res.set('Content-Type', contentType);
      res.send(decryptedBuffer);
    } else {
      res.sendFile(fullPath);
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to view document');
    res.status(500).json({ message: 'Failed to retrieve document' });
  }
};

module.exports = exports;
