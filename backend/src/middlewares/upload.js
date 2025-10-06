const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  }
});

// Central allowlists (tighten as needed)
const EXT_WHITELIST = [
  '.jpg','.jpeg','.png','.webp','.gif', // images
  '.mp4','.mov','.webm', // limited video set (exclude mkv/avi for risk & transcoding simplicity)
  '.pdf'
];
const MIME_WHITELIST = [
  'image/jpeg','image/png','image/webp','image/gif',
  'video/mp4','video/quicktime','video/webm',
  'application/pdf'
];

function fileFilter(req, file, cb) {
  const ext = (file.originalname && file.originalname.includes('.')) ? file.originalname.substring(file.originalname.lastIndexOf('.')).toLowerCase() : '';
  if (!EXT_WHITELIST.includes(ext) || !MIME_WHITELIST.includes(file.mimetype)) {
    return cb(new Error('Unsupported file type'));
  }
  cb(null, true);
}

// Size limits (tune as needed)
const DEFAULT_MAX = 10 * 1024 * 1024; // 10MB generic
const KYC_MAX = 50 * 1024 * 1024; // 50MB for video/selfie

const upload = multer({ storage, fileFilter, limits: { fileSize: DEFAULT_MAX } });
const kycUpload = multer({ storage, fileFilter, limits: { fileSize: KYC_MAX } });

module.exports = { upload, kycUpload };
