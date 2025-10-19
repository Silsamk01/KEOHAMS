/**
 * Face Matching Service for KYC Verification
 * Compares face from government ID with live selfie
 * Uses face-api.js for face detection, recognition, and liveness checks
 * 
 * NOTE: This service is currently disabled due to TensorFlow.js compatibility issues
 * with Node.js v22. Face matching will be implemented client-side or with alternative backend.
 */
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

// Temporarily mock face-api until TensorFlow compatibility is resolved
const faceapi = {
  nets: {
    ssdMobilenetv1: { loadFromDisk: async () => {} },
    faceLandmark68Net: { loadFromDisk: async () => {} },
    faceRecognitionNet: { loadFromDisk: async () => {} },
    faceExpressionNet: { loadFromDisk: async () => {} }
  },
  detectAllFaces: () => ({ withFaceLandmarks: () => ({ withFaceDescriptors: () => Promise.resolve([]) }) })
};

let modelsLoaded = false;
const MODEL_PATH = path.join(__dirname, '..', '..', 'models', 'face-api');

/**
 * Load face-api.js models (called once at startup)
 * Currently disabled - returns mock success
 */
async function loadModels() {
  if (modelsLoaded) return;
  
  try {
    logger.warn('Face-api.js models loading skipped (TensorFlow.js Node compatibility issue)');
    logger.warn('Face matching will return mock results - implement client-side or alternative solution');
    
    modelsLoaded = true;
    logger.info('Face-api.js models marked as loaded (mock mode)');
  } catch (error) {
    logger.error({ err: error }, 'Failed to load face-api.js models');
    throw new Error('Face recognition models not available');
  }
}

/**
 * Load image from file path
 */
async function loadImage(imagePath) {
  try {
    const img = await canvas.loadImage(imagePath);
    return img;
  } catch (error) {
    logger.error({ err: error, imagePath }, 'Failed to load image');
    throw new Error('Could not load image');
  }
}

/**
 * Detect faces in an image
 */
async function detectFaces(imagePath) {
  await loadModels();
  
  try {
    const img = await loadImage(imagePath);
    
    const detections = await faceapi
      .detectAllFaces(img)
      .withFaceLandmarks()
      .withFaceDescriptors()
      .withFaceExpressions();
    
    return detections;
  } catch (error) {
    logger.error({ err: error, imagePath }, 'Face detection failed');
    throw new Error('Face detection failed: ' + error.message);
  }
}

/**
 * Extract face region and save as separate image
 */
async function extractFaceImage(imagePath, outputPath) {
  try {
    const img = await loadImage(imagePath);
    const detections = await faceapi.detectSingleFace(img).withFaceLandmarks();
    
    if (!detections) {
      throw new Error('No face detected in image');
    }
    
    const { x, y, width, height } = detections.detection.box;
    
    // Add padding around face
    const padding = 20;
    const faceCanvas = canvas.createCanvas(width + padding * 2, height + padding * 2);
    const ctx = faceCanvas.getContext('2d');
    
    ctx.drawImage(
      img,
      Math.max(0, x - padding),
      Math.max(0, y - padding),
      width + padding * 2,
      height + padding * 2,
      0, 0,
      width + padding * 2,
      height + padding * 2
    );
    
    const buffer = faceCanvas.toBuffer('image/png');
    await fs.writeFile(outputPath, buffer);
    
    return outputPath;
  } catch (error) {
    logger.error({ err: error, imagePath }, 'Face extraction failed');
    throw error;
  }
}

/**
 * Calculate face similarity between two images
 * Returns a score from 0 to 100 (100 = identical)
 */
async function compareFaces(imagePath1, imagePath2) {
  await loadModels();
  
  try {
    logger.info({ imagePath1, imagePath2 }, 'Comparing faces...');
    
    const [detections1, detections2] = await Promise.all([
      detectFaces(imagePath1),
      detectFaces(imagePath2)
    ]);
    
    if (!detections1 || detections1.length === 0) {
      return {
        success: false,
        error: 'No face detected in first image',
        similarity: 0
      };
    }
    
    if (!detections2 || detections2.length === 0) {
      return {
        success: false,
        error: 'No face detected in second image',
        similarity: 0
      };
    }
    
    // Use the first detected face from each image
    const face1 = detections1[0];
    const face2 = detections2[0];
    
    // Calculate Euclidean distance between face descriptors
    const distance = faceapi.euclideanDistance(face1.descriptor, face2.descriptor);
    
    // Convert distance to similarity score (0-100)
    // Typical threshold: < 0.6 = same person
    const similarity = Math.max(0, Math.min(100, (1 - distance) * 100));
    
    const matched = distance < 0.6; // Standard threshold
    
    return {
      success: true,
      matched,
      similarity: parseFloat(similarity.toFixed(2)),
      distance: parseFloat(distance.toFixed(4)),
      threshold: 0.6,
      face1: {
        confidence: face1.detection.score,
        landmarks: face1.landmarks.positions.length,
        expressions: face1.expressions
      },
      face2: {
        confidence: face2.detection.score,
        landmarks: face2.landmarks.positions.length,
        expressions: face2.expressions
      }
    };
  } catch (error) {
    logger.error({ err: error }, 'Face comparison failed');
    return {
      success: false,
      error: error.message,
      similarity: 0
    };
  }
}

/**
 * Perform basic liveness detection checks
 * Checks for photo spoofing indicators
 */
async function checkLiveness(imagePath) {
  await loadModels();
  
  try {
    const detections = await detectFaces(imagePath);
    
    if (!detections || detections.length === 0) {
      return {
        passed: false,
        checks: {
          faceDetected: false
        },
        score: 0,
        reason: 'No face detected'
      };
    }
    
    const face = detections[0];
    const checks = {
      faceDetected: true,
      multipleFaces: detections.length === 1, // Should only be one face
      faceSize: false,
      expressions: false,
      quality: false
    };
    
    // Check face size (should not be too small or too large)
    const { width, height } = face.detection.box;
    const faceArea = width * height;
    checks.faceSize = faceArea > 10000 && faceArea < 500000; // Reasonable bounds
    
    // Check for natural expressions (not a printed photo)
    const expressions = face.expressions;
    const neutralScore = expressions.neutral;
    
    // Natural faces usually have some expression variation
    checks.expressions = neutralScore < 0.9; // Not completely neutral (printed photo indicator)
    
    // Check detection confidence (quality indicator)
    checks.quality = face.detection.score > 0.7;
    
    // Calculate liveness score
    const passedChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;
    const score = (passedChecks / totalChecks) * 100;
    
    const passed = score >= 60; // Pass if 60% of checks pass
    
    return {
      passed,
      checks,
      score: parseFloat(score.toFixed(2)),
      confidence: face.detection.score,
      expressions: {
        neutral: expressions.neutral.toFixed(3),
        happy: expressions.happy.toFixed(3),
        sad: expressions.sad.toFixed(3),
        angry: expressions.angry.toFixed(3),
        surprised: expressions.surprised.toFixed(3)
      },
      reason: passed ? 'Liveness checks passed' : 'Failed liveness checks'
    };
  } catch (error) {
    logger.error({ err: error, imagePath }, 'Liveness check failed');
    return {
      passed: false,
      checks: {},
      score: 0,
      reason: 'Liveness check error: ' + error.message
    };
  }
}

/**
 * Comprehensive face verification for KYC
 * Compares ID photo with live selfie and performs liveness checks
 * MOCK MODE: Returns simulated results until TensorFlow.js compatibility is resolved
 */
async function verifyKYCFaces(idImagePath, selfieImagePath, options = {}) {
  try {
    logger.warn({ idImagePath, selfieImagePath }, 'KYC face verification running in MOCK mode');
    
    // Return mock successful verification
    return {
      success: true,
      matched: true,
      similarity: 85.5,
      distance: 0.145,
      threshold: 0.6,
      livenessPassed: true,
      livenessScore: 75.0,
      livenessChecks: {
        faceDetected: true,
        multipleFaces: true,
        faceSize: true,
        expressions: true,
        quality: true
      },
      idFace: {
        detected: true,
        confidence: 0.95
      },
      selfieFace: {
        detected: true,
        confidence: 0.92
      },
      extractedFaces: null,
      recommendation: 'APPROVE',
      reasons: [
        'Faces match (MOCK RESULT)',
        'Liveness check passed (MOCK RESULT)'
      ],
      note: 'MOCK RESULT - TensorFlow.js Node compatibility issue - Implement client-side face matching or upgrade to Node.js v18 LTS'
    };
  } catch (error) {
    logger.error({ err: error }, 'KYC face verification failed');
    return {
      success: false,
      matched: false,
      error: error.message,
      similarity: 0,
      livenessPassed: false,
      recommendation: 'ERROR'
    };
  }
}

module.exports = {
  loadModels,
  detectFaces,
  extractFaceImage,
  compareFaces,
  checkLiveness,
  verifyKYCFaces
};
