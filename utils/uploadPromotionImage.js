import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const promotionsDir = join(__dirname, '..', 'uploads', 'promotions');

try {
  fs.mkdirSync(promotionsDir, { recursive: true });
} catch (_) {}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, promotionsDir),
  filename: (_req, file, cb) => {
    const ext = (file.originalname && file.originalname.split('.').pop()) || 'jpg';
    const safeExt = /^[a-zA-Z0-9]+$/.test(ext) ? ext : 'jpg';
    cb(null, `${randomUUID()}.${safeExt}`);
  },
});

export const uploadPromotionImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.mimetype);
    if (allowed) cb(null, true);
    else cb(new Error('INVALID_IMAGE_TYPE'), false);
  },
});
