/**
 * Document Encryption Service for KYC
 * Encrypts sensitive KYC documents at rest
 * Compliant with GDPR/NDPR requirements
 */
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

/**
 * Generate a secure encryption key from master password + salt
 */
function deriveKey(masterPassword, salt) {
  return crypto.pbkdf2Sync(masterPassword, salt, 100000, KEY_LENGTH, 'sha512');
}

/**
 * Get master encryption key from environment
 */
function getMasterKey() {
  const masterPassword = process.env.KYC_ENCRYPTION_KEY || process.env.JWT_SECRET;
  
  if (!masterPassword) {
    throw new Error('KYC_ENCRYPTION_KEY not configured');
  }
  
  return masterPassword;
}

/**
 * Encrypt file and save encrypted version
 */
async function encryptFile(inputPath, outputPath = null) {
  try {
    // Read file
    const fileBuffer = await fs.readFile(inputPath);
    
    // Generate salt and derive key
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = deriveKey(getMasterKey(), salt);
    
    // Generate IV
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt
    const encrypted = Buffer.concat([
      cipher.update(fileBuffer),
      cipher.final()
    ]);
    
    // Get auth tag
    const authTag = cipher.getAuthTag();
    
    // Combine: salt + iv + authTag + encrypted data
    const result = Buffer.concat([
      salt,
      iv,
      authTag,
      encrypted
    ]);
    
    // Save encrypted file
    const encryptedPath = outputPath || `${inputPath}.encrypted`;
    await fs.writeFile(encryptedPath, result);
    
    // Generate encryption metadata
    const encryptionId = crypto.randomBytes(16).toString('hex');
    
    logger.info({ inputPath, encryptedPath, encryptionId }, 'File encrypted successfully');
    
    return {
      encryptedPath,
      encryptionId,
      algorithm: ALGORITHM,
      originalSize: fileBuffer.length,
      encryptedSize: result.length
    };
  } catch (error) {
    logger.error({ err: error, inputPath }, 'File encryption failed');
    throw new Error('Encryption failed: ' + error.message);
  }
}

/**
 * Decrypt file
 */
async function decryptFile(encryptedPath, outputPath = null) {
  try {
    // Read encrypted file
    const encryptedBuffer = await fs.readFile(encryptedPath);
    
    // Extract components
    const salt = encryptedBuffer.subarray(0, SALT_LENGTH);
    const iv = encryptedBuffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = encryptedBuffer.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const encrypted = encryptedBuffer.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    
    // Derive key
    const key = deriveKey(getMasterKey(), salt);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    // Save decrypted file if output path provided
    if (outputPath) {
      await fs.writeFile(outputPath, decrypted);
      logger.info({ encryptedPath, outputPath }, 'File decrypted successfully');
    }
    
    return decrypted;
  } catch (error) {
    logger.error({ err: error, encryptedPath }, 'File decryption failed');
    throw new Error('Decryption failed: ' + error.message);
  }
}

/**
 * Encrypt sensitive text data (for storing in database)
 */
function encryptText(plaintext) {
  try {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = deriveKey(getMasterKey(), salt);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(plaintext, 'utf8')),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // Combine and encode as base64
    const result = Buffer.concat([salt, iv, authTag, encrypted]);
    return result.toString('base64');
  } catch (error) {
    logger.error({ err: error }, 'Text encryption failed');
    throw new Error('Text encryption failed');
  }
}

/**
 * Decrypt text data
 */
function decryptText(encryptedBase64) {
  try {
    const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');
    
    const salt = encryptedBuffer.subarray(0, SALT_LENGTH);
    const iv = encryptedBuffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = encryptedBuffer.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const encrypted = encryptedBuffer.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    
    const key = deriveKey(getMasterKey(), salt);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    logger.error({ err: error }, 'Text decryption failed');
    throw new Error('Text decryption failed');
  }
}

/**
 * Encrypt KYC document and optionally delete original
 */
async function encryptKYCDocument(originalPath, deleteOriginal = true) {
  try {
    const encryptedPath = `${originalPath}.enc`;
    const result = await encryptFile(originalPath, encryptedPath);
    
    // Delete original if requested (for GDPR compliance)
    if (deleteOriginal) {
      await fs.unlink(originalPath);
      logger.info({ originalPath }, 'Original file deleted after encryption');
    }
    
    return {
      ...result,
      originalDeleted: deleteOriginal
    };
  } catch (error) {
    logger.error({ err: error, originalPath }, 'KYC document encryption failed');
    throw error;
  }
}

/**
 * Get decrypted document as buffer (for viewing/downloading)
 */
async function getDecryptedDocument(encryptedPath) {
  try {
    return await decryptFile(encryptedPath);
  } catch (error) {
    logger.error({ err: error, encryptedPath }, 'Failed to decrypt document');
    throw new Error('Could not decrypt document');
  }
}

/**
 * Securely delete file (overwrite then delete)
 */
async function secureDelete(filePath) {
  try {
    const stats = await fs.stat(filePath);
    const fileSize = stats.size;
    
    // Overwrite with random data 3 times
    for (let i = 0; i < 3; i++) {
      const randomData = crypto.randomBytes(fileSize);
      await fs.writeFile(filePath, randomData);
    }
    
    // Finally delete
    await fs.unlink(filePath);
    
    logger.info({ filePath }, 'File securely deleted');
  } catch (error) {
    logger.error({ err: error, filePath }, 'Secure delete failed');
    throw error;
  }
}

/**
 * Hash document for integrity verification
 */
function hashDocument(fileBuffer) {
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Check if file is encrypted
 */
async function isEncrypted(filePath) {
  try {
    // Only rely on explicit encrypted extensions to avoid false positives
    return filePath.endsWith('.enc') || filePath.endsWith('.encrypted');
  } catch (_error) {
    return false;
  }
}

module.exports = {
  encryptFile,
  decryptFile,
  encryptText,
  decryptText,
  encryptKYCDocument,
  getDecryptedDocument,
  secureDelete,
  hashDocument,
  isEncrypted
};
