const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model';
const MODELS_DIR = path.join(__dirname, 'models', 'face-api');

// Models and their files (single .bin files per model)
const modelsToDownload = [
  {
    name: 'ssdMobilenetv1',
    files: [
      'ssd_mobilenetv1_model-weights_manifest.json',
      'ssd_mobilenetv1_model.bin'
    ]
  },
  {
    name: 'faceLandmark68Net',
    files: [
      'face_landmark_68_model-weights_manifest.json',
      'face_landmark_68_model.bin'
    ]
  },
  {
    name: 'faceRecognitionNet',
    files: [
      'face_recognition_model-weights_manifest.json',
      'face_recognition_model.bin'
    ]
  },
  {
    name: 'faceExpressionNet',
    files: [
      'face_expression_model-weights_manifest.json',
      'face_expression_model.bin'
    ]
  }
];

// Create directories
if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
}

console.log('📦 Downloading face-api.js models...\n');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else {
        fs.unlink(dest, () => {});
        reject(new Error(`Failed to download: ${url} (Status: ${response.statusCode})`));
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function downloadModels() {
  let totalFiles = 0;
  let downloadedFiles = 0;

  // Count total files
  for (const model of modelsToDownload) {
    totalFiles += model.files.length;
  }

  for (const model of modelsToDownload) {
    const modelDir = path.join(MODELS_DIR, model.name);
    
    // Create model directory
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }

    console.log(`📁 Downloading ${model.name}...`);

    for (const file of model.files) {
      const url = `${BASE_URL}/${file}`;
      const dest = path.join(modelDir, file);

      try {
        await downloadFile(url, dest);
        downloadedFiles++;
        console.log(`  ✅ ${file} (${downloadedFiles}/${totalFiles})`);
      } catch (error) {
        console.error(`  ❌ Failed to download ${file}:`, error.message);
      }
    }
    console.log('');
  }

  console.log('🎉 Download complete!');
  console.log(`📊 Downloaded ${downloadedFiles}/${totalFiles} files`);
  console.log(`📂 Models saved to: ${MODELS_DIR}`);
}

downloadModels().catch(console.error);
