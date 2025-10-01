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

const fileFilter = (req, file, cb) => {
  // allow common image/video/doc types; extended for camera captures (webm, heic/heif, m4v)
  const nameAllowed = /\.(jpg|jpeg|png|gif|webp|heic|heif|mp4|mov|m4v|avi|mkv|webm|pdf|docx?)$/i;
  const typeAllowed = /^(image\/(jpeg|png|gif|webp|heic|heif)|video\/(mp4|quicktime|x-m4v|x-msvideo|x-matroska|webm)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document))$/i;
  const okByName = nameAllowed.test(file.originalname || '');
  const okByType = typeAllowed.test(file.mimetype || '');
  if (!(okByName || okByType)) return cb(new Error('Unsupported file type'));
  cb(null, true);
};

// Default upload (20MB max per file)
const upload = multer({ storage, fileFilter, limits: { fileSize: 20 * 1024 * 1024 } });

// KYC upload with larger allowed sizes (e.g., up to 100MB files)
const kycUpload = multer({ storage, fileFilter, limits: { fileSize: 100 * 1024 * 1024 } });

module.exports = { upload, kycUpload };
