import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';
import config from '../config/index.js';
import { BadRequestError } from './errorHandler.js';

// Ensure upload directories exist
const uploadDirs = [
  'prescriptions',
  'ids',
  'medicines',
  'documents',
  'avatars',
  'delivery-proofs',
  'temp',
];

uploadDirs.forEach((dir) => {
  const dirPath = path.join(config.upload.dir, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Storage configuration
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    let uploadPath = path.join(config.upload.dir, 'temp');

    // Determine destination based on fieldname or route
    if (file.fieldname === 'prescription' || req.path.includes('prescription')) {
      uploadPath = path.join(config.upload.dir, 'prescriptions');
    } else if (file.fieldname === 'governmentId' || file.fieldname === 'insuranceCard') {
      uploadPath = path.join(config.upload.dir, 'ids');
    } else if (file.fieldname === 'medicineImage') {
      uploadPath = path.join(config.upload.dir, 'medicines');
    } else if (file.fieldname === 'avatar') {
      uploadPath = path.join(config.upload.dir, 'avatars');
    } else if (file.fieldname === 'deliveryProof') {
      uploadPath = path.join(config.upload.dir, 'delivery-proofs');
    } else if (file.fieldname === 'document') {
      uploadPath = path.join(config.upload.dir, 'documents');
    }

    cb(null, uploadPath);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    // Generate unique filename
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${uniqueId}${ext}`;
    cb(null, filename);
  },
});

// File filter
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  // For prescription uploads, accept any file type for pharmacist review flows.
  if (file.fieldname === 'prescription' || req.path.includes('prescription')) {
    cb(null, true);
    return;
  }

  // Check allowed types
  if (config.upload.allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestError(`File type ${file.mimetype} is not allowed`));
  }
};

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize, // 10MB default
    files: 10, // Maximum 10 files per request
  },
});

// Specific upload configurations
export const uploadPrescription = upload.array('prescription', 5);
export const uploadSinglePrescription = upload.single('prescription');
export const uploadAvatar = upload.single('avatar');
export const uploadMedicineImages = upload.array('medicineImage', 10);
export const uploadIdDocuments = upload.fields([
  { name: 'governmentId', maxCount: 1 },
  { name: 'insuranceCard', maxCount: 1 },
]);
export const uploadDeliveryProof = upload.single('deliveryProof');
export const uploadDocument = upload.single('document');
export const uploadMultiple = upload.array('files', 10);

// Public URL path is always /uploads/<subdir>/... (single "uploads" segment).
export const getFileUrl = (filePath: string): string => {
  if (!filePath || typeof filePath !== 'string') return '';
  const base = config.app.url.replace(/\/$/, '');
  const uploadRoot = path.resolve(config.upload.dir).replace(/\\/g, '/');
  const absolute = path.resolve(filePath).replace(/\\/g, '/');

  let underRoot = '';
  if (absolute.startsWith(uploadRoot)) {
    underRoot = absolute.slice(uploadRoot.length).replace(/^\/+/, '');
  } else {
    underRoot = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
  }

  // Avoid /uploads/uploads/... when DB paths already include "uploads/"
  underRoot = underRoot.replace(/^uploads\//, '');

  if (!underRoot) return '';
  return `${base}/uploads/${underRoot}`;
};

// Helper function to delete file
export const deleteFile = (filePath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err) {
        // File might not exist, which is okay
        if (err.code === 'ENOENT') {
          resolve();
        } else {
          reject(err);
        }
      } else {
        resolve();
      }
    });
  });
};

// Helper function to move file
export const moveFile = (sourcePath: string, destDir: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const fileName = path.basename(sourcePath);
    const destPath = path.join(destDir, fileName);

    fs.rename(sourcePath, destPath, (err) => {
      if (err) {
        // If rename fails (cross-device), try copy then delete
        fs.copyFile(sourcePath, destPath, (copyErr) => {
          if (copyErr) {
            reject(copyErr);
          } else {
            fs.unlink(sourcePath, (unlinkErr) => {
              if (unlinkErr) {
                console.error('Failed to delete source file:', unlinkErr);
              }
              resolve(destPath);
            });
          }
        });
      } else {
        resolve(destPath);
      }
    });
  });
};

export default upload;
