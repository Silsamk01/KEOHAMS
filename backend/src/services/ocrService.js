/**
 * OCR Service for extracting data from government IDs and documents
 * Uses Tesseract.js for text extraction and pattern matching for structured data
 */
const { createWorker } = require('tesseract.js');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

// Initialize Tesseract worker pool
let workerPool = [];
const MAX_WORKERS = 2;

async function initializeWorkerPool() {
  if (workerPool.length > 0) return;
  
  logger.info('Initializing OCR worker pool...');
  for (let i = 0; i < MAX_WORKERS; i++) {
    const worker = await createWorker('eng', 1, {
      logger: m => logger.debug({ ocrProgress: m }, 'OCR Worker'),
    });
    workerPool.push(worker);
  }
  logger.info(`OCR worker pool initialized with ${MAX_WORKERS} workers`);
}

async function getWorker() {
  if (workerPool.length === 0) {
    await initializeWorkerPool();
  }
  return workerPool[0]; // Simple round-robin can be added
}

/**
 * Extract text from image using OCR
 */
async function extractText(imagePath) {
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(imagePath);
    
    return {
      text: data.text,
      confidence: data.confidence,
      words: data.words.map(w => ({
        text: w.text,
        confidence: w.confidence,
        bbox: w.bbox
      })),
      lines: data.lines.map(l => ({
        text: l.text,
        confidence: l.confidence,
        bbox: l.bbox
      }))
    };
  } catch (error) {
    logger.error({ err: error, imagePath }, 'OCR extraction failed');
    throw new Error('OCR extraction failed: ' + error.message);
  }
}

/**
 * Parse government ID data from OCR text
 * Uses pattern matching for common ID formats
 */
function parseGovernmentID(ocrData, idType) {
  const text = ocrData.text.toUpperCase();
  const lines = ocrData.lines.map(l => l.text);
  
  const parsed = {
    id_number: null,
    full_name: null,
    date_of_birth: null,
    issue_date: null,
    expiry_date: null,
    address: null,
    gender: null,
    nationality: null
  };

  // ID Number patterns
  const idPatterns = {
    NATIONAL_ID: /\b[A-Z0-9]{9,15}\b/g, // Typical national ID format
    DRIVERS_LICENSE: /\b[A-Z]{1,3}[0-9]{6,12}\b/g,
    PASSPORT: /\b[A-Z][0-9]{7,9}\b/g
  };

  // Extract ID number
  const idPattern = idPatterns[idType] || idPatterns.NATIONAL_ID;
  const idMatches = text.match(idPattern);
  if (idMatches && idMatches.length > 0) {
    // Take the longest match (usually the actual ID)
    parsed.id_number = idMatches.reduce((a, b) => a.length > b.length ? a : b);
  }

  // Extract dates (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD formats)
  const datePattern = /\b(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})\b|\b(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})\b/g;
  const dateMatches = [...text.matchAll(datePattern)];
  
  const dates = dateMatches.map(m => {
    if (m[1]) return `${m[3]}-${m[2]}-${m[1]}`; // DD/MM/YYYY
    if (m[4]) return `${m[4]}-${m[5]}-${m[6]}`; // YYYY-MM-DD
    return null;
  }).filter(Boolean);

  // Heuristics for date assignment
  if (dates.length >= 1) parsed.date_of_birth = dates[0];
  if (dates.length >= 2) parsed.issue_date = dates[1];
  if (dates.length >= 3) parsed.expiry_date = dates[2];

  // Look for common keywords
  const dobKeywords = /DATE OF BIRTH|DOB|BIRTH/i;
  const issueKeywords = /ISSUE|ISSUED|DATE OF ISSUE/i;
  const expiryKeywords = /EXPIRY|EXPIRES|VALID UNTIL|EXPIRATION/i;

  lines.forEach((line, idx) => {
    const upperLine = line.toUpperCase();
    
    if (dobKeywords.test(upperLine) && dates[0]) {
      parsed.date_of_birth = dates[0];
    }
    if (issueKeywords.test(upperLine) && dates[1]) {
      parsed.issue_date = dates[1];
    }
    if (expiryKeywords.test(upperLine) && dates[2]) {
      parsed.expiry_date = dates[2];
    }
  });

  // Extract name (usually appears near top, often after "NAME" keyword)
  const namePattern = /NAME[:\s]+([A-Z\s]{5,50})/i;
  const nameMatch = text.match(namePattern);
  if (nameMatch) {
    parsed.full_name = nameMatch[1].trim();
  }

  // Gender detection
  if (/\bMALE\b/.test(text) && !/\bFEMALE\b/.test(text)) parsed.gender = 'MALE';
  else if (/\bFEMALE\b/.test(text)) parsed.gender = 'FEMALE';

  return parsed;
}

/**
 * Parse address proof document (utility bill, bank statement)
 */
function parseAddressProof(ocrData) {
  const text = ocrData.text;
  const lines = ocrData.lines.map(l => l.text);
  
  const parsed = {
    document_date: null,
    account_holder: null,
    address_lines: [],
    full_address: null
  };

  // Extract date
  const datePattern = /\b(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})\b|\b(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})\b/g;
  const dateMatches = [...text.matchAll(datePattern)];
  if (dateMatches.length > 0) {
    const match = dateMatches[0];
    if (match[1]) parsed.document_date = `${match[3]}-${match[2]}-${match[1]}`;
    else if (match[4]) parsed.document_date = `${match[4]}-${match[5]}-${match[6]}`;
  }

  // Extract address (heuristic: lines containing street/city keywords)
  const addressKeywords = /street|road|avenue|lane|drive|city|state|zip|postal/i;
  parsed.address_lines = lines.filter(line => 
    addressKeywords.test(line) || 
    /\d{3,6}/.test(line) // Contains numbers (house numbers, zip codes)
  );

  parsed.full_address = parsed.address_lines.join(', ');

  return parsed;
}

/**
 * Validate if document has expired
 */
function checkDocumentExpiry(expiryDateStr) {
  if (!expiryDateStr) return { expired: false, message: 'No expiry date found' };
  
  try {
    const expiryDate = new Date(expiryDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (expiryDate < today) {
      const daysExpired = Math.floor((today - expiryDate) / (1000 * 60 * 60 * 24));
      return { expired: true, message: `Document expired ${daysExpired} days ago`, expiryDate };
    }
    
    const daysRemaining = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
    return { expired: false, message: `Valid for ${daysRemaining} more days`, expiryDate };
  } catch (error) {
    return { expired: false, message: 'Invalid date format' };
  }
}

/**
 * Check if address proof is recent (within 3 months)
 */
function checkAddressProofRecency(documentDateStr) {
  if (!documentDateStr) return { recent: false, message: 'No date found on document' };
  
  try {
    const docDate = new Date(documentDateStr);
    const today = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    if (docDate < threeMonthsAgo) {
      const monthsOld = Math.floor((today - docDate) / (1000 * 60 * 60 * 24 * 30));
      return { recent: false, message: `Document is ${monthsOld} months old (must be within 3 months)` };
    }
    
    return { recent: true, message: 'Document is recent', documentDate: docDate };
  } catch (error) {
    return { recent: false, message: 'Invalid date format' };
  }
}

/**
 * Main OCR processing function for KYC documents
 */
async function processKYCDocument(imagePath, documentType, idType = null) {
  try {
    logger.info({ imagePath, documentType, idType }, 'Processing KYC document with OCR');
    
    // Extract text
    const ocrData = await extractText(imagePath);
    
    let parsedData = {};
    let validationResults = {};
    
    if (documentType === 'ID') {
      parsedData = parseGovernmentID(ocrData, idType);
      
      // Validate expiry
      if (parsedData.expiry_date) {
        validationResults.expiryCheck = checkDocumentExpiry(parsedData.expiry_date);
      }
    } else if (documentType === 'ADDRESS_PROOF') {
      parsedData = parseAddressProof(ocrData);
      
      // Validate recency
      if (parsedData.document_date) {
        validationResults.recencyCheck = checkAddressProofRecency(parsedData.document_date);
      }
    }
    
    return {
      success: true,
      ocrData: {
        rawText: ocrData.text,
        confidence: ocrData.confidence,
        words: ocrData.words,
        lines: ocrData.lines
      },
      parsedData,
      validationResults,
      requiresManualReview: ocrData.confidence < 70 || !parsedData.id_number
    };
  } catch (error) {
    logger.error({ err: error, imagePath, documentType }, 'OCR processing failed');
    return {
      success: false,
      error: error.message,
      requiresManualReview: true
    };
  }
}

// Cleanup workers on shutdown
async function cleanup() {
  logger.info('Cleaning up OCR workers...');
  for (const worker of workerPool) {
    await worker.terminate();
  }
  workerPool = [];
}

module.exports = {
  extractText,
  parseGovernmentID,
  parseAddressProof,
  checkDocumentExpiry,
  checkAddressProofRecency,
  processKYCDocument,
  initializeWorkerPool,
  cleanup
};
