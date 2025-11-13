/**
 * Background Job Queue using BullMQ + Redis
 * Handles async processing for OCR, face matching, and other heavy tasks
 */

const { Queue, Worker } = require('bullmq');
const logger = require('../utils/logger');
const ocrService = require('../services/ocrService');
const faceMatchService = require('../services/faceMatchService');
const db = require('../config/db');

// Redis connection configuration
const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  username: process.env.REDIS_USERNAME || undefined,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB) || 0,
  maxRetriesPerRequest: null, // Important for BullMQ
  tls: process.env.REDIS_TLS === 'true' ? {
    rejectUnauthorized: false
  } : undefined
};

// Create job queues
let kycProcessingQueue;
let emailQueue;
let queuesAvailable = false;

try {
  // KYC Processing Queue (OCR + Face Matching)
  kycProcessingQueue = new Queue('kyc-processing', {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 1000
      },
      removeOnFail: {
        age: 7 * 24 * 3600 // Keep failed jobs for 7 days
      }
    }
  });

  // Email Queue
  emailQueue = new Queue('email-notifications', {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      removeOnComplete: {
        age: 3600, // Keep completed for 1 hour
        count: 500
      }
    }
  });

  queuesAvailable = true;
  logger.info('Job queues initialized');
} catch (err) {
  logger.warn({ err }, 'Failed to initialize job queues, will process synchronously');
  queuesAvailable = false;
}

/**
 * Add KYC processing job to queue
 * @param {Object} data - Job data
 * @param {number} data.submissionId - KYC submission ID
 * @param {string} data.idDocumentPath - Path to ID document
 * @param {string} data.selfiePath - Path to selfie
 * @param {string} data.addressProofPath - Path to address proof
 * @returns {Promise<Job>}
 */
async function addKYCProcessingJob(data) {
  if (!queuesAvailable || !kycProcessingQueue) {
    throw new Error('Job queue not available');
  }

  const job = await kycProcessingQueue.add('process-kyc', data, {
    jobId: `kyc-${data.submissionId}`,
    priority: 1
  });

  logger.info({ jobId: job.id, submissionId: data.submissionId }, 'KYC processing job added to queue');
  return job;
}

/**
 * Add email notification job to queue
 * @param {Object} data - Email data
 * @param {string} data.to - Recipient email
 * @param {string} data.subject - Email subject
 * @param {string} data.html - Email HTML body
 * @returns {Promise<Job>}
 */
async function addEmailJob(data) {
  if (!queuesAvailable || !emailQueue) {
    throw new Error('Email queue not available');
  }

  const job = await emailQueue.add('send-email', data, {
    priority: data.priority || 10
  });

  logger.info({ jobId: job.id, to: data.to }, 'Email job added to queue');
  return job;
}

/**
 * KYC Processing Worker
 * Processes OCR and face matching for KYC submissions
 */
function createKYCWorker() {
  if (!queuesAvailable) {
    logger.warn('Skipping KYC worker creation - queues not available');
    return null;
  }

  const worker = new Worker('kyc-processing', async (job) => {
    const { submissionId, idDocumentPath, selfiePath, addressProofPath } = job.data;
    
    logger.info({ jobId: job.id, submissionId }, 'Processing KYC submission');

    try {
      // Update status to processing
      await db('kyc_submissions')
        .where({ id: submissionId })
        .update({ 
          status: 'UNDER_REVIEW',
          ocr_status: 'PENDING'
        });

      // Step 1: OCR Processing on ID document
      let ocrResult = null;
      if (idDocumentPath) {
        await job.updateProgress(10);
        logger.info({ submissionId }, 'Starting OCR processing');
        
        ocrResult = await ocrService.extractFromGovernmentID(idDocumentPath);
        
        // Save OCR results
        await db('kyc_submissions')
          .where({ id: submissionId })
          .update({
            ocr_data: JSON.stringify(ocrResult.fields || {}),
            ocr_confidence: ocrResult.confidence || 0,
            ocr_status: ocrResult.success ? 'SUCCESS' : 'FAILED',
            document_expired: ocrResult.expired || false
          });

        // Store in OCR results table
        await db('kyc_ocr_results').insert({
          kyc_submission_id: submissionId,
          document_type: 'ID',
          extracted_text: JSON.stringify(ocrResult.rawText || ''),
          parsed_fields: JSON.stringify(ocrResult.fields || {}),
          confidence_score: ocrResult.confidence || 0,
          requires_manual_review: ocrResult.confidence < 70
        });

        await job.updateProgress(40);
      }

      // Step 2: Face Matching
      let faceMatchResult = null;
      if (idDocumentPath && selfiePath) {
        await job.updateProgress(50);
        logger.info({ submissionId }, 'Starting face matching');
        
        faceMatchResult = await faceMatchService.verifyKYCFaces(idDocumentPath, selfiePath);

        // Save face match results
        await db('kyc_submissions')
          .where({ id: submissionId })
          .update({
            face_match_score: faceMatchResult.similarity || 0,
            face_match_status: faceMatchResult.matched ? 'MATCHED' : 'NOT_MATCHED',
            liveness_check_passed: faceMatchResult.livenessPassed || false
          });

        // Store in face matches table
        await db('kyc_face_matches').insert({
          kyc_submission_id: submissionId,
          similarity_score: faceMatchResult.similarity || 0,
          liveness_passed: faceMatchResult.livenessPassed || false,
          liveness_score: faceMatchResult.livenessScore || 0,
          match_threshold: faceMatchResult.threshold || 60,
          algorithm_version: '1.0-mock' // Update when real algo is implemented
        });

        await job.updateProgress(80);
      }

      // Step 3: Auto-decision logic
      let autoDecision = 'UNDER_REVIEW'; // Default to manual review
      
      if (ocrResult && faceMatchResult) {
        const highConfidence = 
          ocrResult.confidence >= 80 &&
          faceMatchResult.similarity >= 75 &&
          faceMatchResult.livenessPassed &&
          !ocrResult.expired;

        if (highConfidence) {
          autoDecision = 'APPROVED';
        } else if (ocrResult.expired) {
          autoDecision = 'REJECTED';
        }
      }

      // Update final status
      await db('kyc_submissions')
        .where({ id: submissionId })
        .update({ 
          status: autoDecision,
          reviewed_at: autoDecision !== 'UNDER_REVIEW' ? db.fn.now() : null
        });

      // Log audit trail
      await db('kyc_audit_log').insert({
        kyc_submission_id: submissionId,
        user_id: (await db('kyc_submissions').where({ id: submissionId }).first()).user_id,
        action: 'OCR_PROCESSED',
        status_before: 'PENDING',
        status_after: autoDecision,
        remarks: `Automated processing complete. OCR: ${ocrResult?.confidence}%, Face: ${faceMatchResult?.similarity}%`
      });

      await job.updateProgress(100);

      logger.info({ submissionId, autoDecision }, 'KYC processing completed');

      return {
        success: true,
        submissionId,
        autoDecision,
        ocrConfidence: ocrResult?.confidence,
        faceMatchScore: faceMatchResult?.similarity
      };

    } catch (error) {
      logger.error({ err: error, submissionId }, 'KYC processing failed');
      
      // Update status to indicate failure
      await db('kyc_submissions')
        .where({ id: submissionId })
        .update({ 
          status: 'UNDER_REVIEW',
          ocr_status: 'FAILED'
        });

      throw error;
    }
  }, {
    connection: redisConnection,
    concurrency: parseInt(process.env.KYC_WORKER_CONCURRENCY) || 2,
    limiter: {
      max: 10, // Max 10 jobs
      duration: 60000 // per minute
    }
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, submissionId: job.data.submissionId }, 'KYC job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, submissionId: job?.data?.submissionId, err }, 'KYC job failed');
  });

  logger.info('KYC processing worker started');
  return worker;
}

/**
 * Email Worker
 * Processes email notification jobs
 */
function createEmailWorker() {
  if (!queuesAvailable) {
    logger.warn('Skipping email worker creation - queues not available');
    return null;
  }

  const worker = new Worker('email-notifications', async (job) => {
    const { to, subject, html } = job.data;
    
    const { sendMail } = require('../utils/email');
    await sendMail(to, subject, html);
    
    logger.info({ jobId: job.id, to }, 'Email sent successfully');
    return { success: true };
  }, {
    connection: redisConnection,
    concurrency: parseInt(process.env.EMAIL_WORKER_CONCURRENCY) || 5
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Email job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Email job failed');
  });

  logger.info('Email worker started');
  return worker;
}

/**
 * Get queue statistics
 */
async function getQueueStats() {
  if (!queuesAvailable) {
    return { available: false };
  }

  const stats = {
    available: true,
    kyc: {},
    email: {}
  };

  if (kycProcessingQueue) {
    stats.kyc = {
      waiting: await kycProcessingQueue.getWaitingCount(),
      active: await kycProcessingQueue.getActiveCount(),
      completed: await kycProcessingQueue.getCompletedCount(),
      failed: await kycProcessingQueue.getFailedCount()
    };
  }

  if (emailQueue) {
    stats.email = {
      waiting: await emailQueue.getWaitingCount(),
      active: await emailQueue.getActiveCount(),
      completed: await emailQueue.getCompletedCount(),
      failed: await emailQueue.getFailedCount()
    };
  }

  return stats;
}

/**
 * Close queues and workers gracefully
 */
async function closeQueues() {
  const promises = [];

  if (kycProcessingQueue) {
    promises.push(kycProcessingQueue.close());
  }

  if (emailQueue) {
    promises.push(emailQueue.close());
  }

  await Promise.all(promises);
  logger.info('Job queues closed');
}

module.exports = {
  addKYCProcessingJob,
  addEmailJob,
  createKYCWorker,
  createEmailWorker,
  getQueueStats,
  closeQueues,
  queuesAvailable
};
