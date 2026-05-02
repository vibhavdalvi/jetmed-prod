// @ts-nocheck
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';

import { Prescription } from '../models/index.js';
import { asyncHandler, BadRequestError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { uploadSinglePrescription, getFileUrl } from '../middleware/upload.js';
import { UserRole, PrescriptionStatus } from '../types/index.js';
import { recordActivity, requestAuditContext } from '../services/activityLog.js';

const router = Router();

router.post('/upload', authenticate, uploadSinglePrescription, asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new BadRequestError('Prescription file is required');

  const { doctorName, doctorLicense, hospitalName, notes, validUntil } = req.body;

  const prescription = await Prescription.create({
    userId: req.user!.userId,
    fileName: req.file.originalname || req.file.filename,
    filePath: req.file.path,
    fileType: req.file.mimetype || 'application/octet-stream',
    status: PrescriptionStatus.PENDING,
    doctorName,
    hospitalName,
    rejectionReason: notes || undefined,
    validityDate: validUntil ? new Date(validUntil) : new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
  });

  const responsePrescription = {
    ...prescription.toJSON(),
    imageUrl: getFileUrl(prescription.filePath),
  };

  void recordActivity({
    action: 'prescription.uploaded',
    entityType: 'prescription',
    entityId: prescription.id,
    userId: req.user!.userId,
    role: req.user!.role,
    metadata: { fileName: prescription.fileName },
    ...requestAuditContext(req),
  });

  res.status(201).json({ success: true, message: 'Prescription uploaded', data: { prescription: responsePrescription } });
}));

router.get('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { status, page = '1', limit = '10' } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 10, 50);

  const filter: Record<string, unknown> = {};
  const pharmacistRoles = [UserRole.PHARMACIST, UserRole.SENIOR_PHARMACIST, UserRole.ADMIN_SUPER];

  if (!pharmacistRoles.includes(req.user!.role as UserRole)) {
    filter.userId = req.user!.userId;
  }
  if (status) filter.status = status;

  const count = await Prescription.countDocuments(filter);
  const prescriptionRows = await Prescription.find(filter)
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)
    .populate({ path: 'user', populate: { path: 'profile' } });

  const prescriptions = prescriptionRows.map((p) => {
    const plain = p.toJSON() as Record<string, unknown>;
    return { ...plain, imageUrl: getFileUrl((plain.filePath as string) || '') };
  });

  res.json({ success: true, data: { prescriptions, total: count, page: pageNum, totalPages: Math.ceil(count / limitNum) } });
}));

router.get('/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const prescription = await Prescription.findById(req.params.id).populate({
    path: 'user',
    populate: { path: 'profile' },
  });

  if (!prescription) throw new NotFoundError('Prescription not found');

  const pharmacistRoles = [UserRole.PHARMACIST, UserRole.SENIOR_PHARMACIST, UserRole.ADMIN_SUPER];
  if (!pharmacistRoles.includes(req.user!.role as UserRole) && prescription.userId !== req.user!.userId) {
    throw new ForbiddenError('Access denied');
  }

  const plain = prescription.toJSON() as Record<string, unknown>;
  res.json({
    success: true,
    data: { prescription: { ...plain, imageUrl: getFileUrl((plain.filePath as string) || '') } },
  });
}));

router.patch('/:id/verify', authenticate, authorize(UserRole.PHARMACIST, UserRole.SENIOR_PHARMACIST, UserRole.ADMIN_SUPER), [
  body('status').isIn([PrescriptionStatus.VERIFIED, PrescriptionStatus.REJECTED]),
  body('rejectionReason').if(body('status').equals(PrescriptionStatus.REJECTED)).notEmpty(),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  const { status, medicines, rejectionReason, notes } = req.body;

  const prescription = await Prescription.findById(req.params.id);
  if (!prescription) throw new NotFoundError('Prescription not found');

  prescription.status = status;
  prescription.verifiedBy = req.user!.userId;
  prescription.verifiedAt = new Date();
  if (rejectionReason !== undefined) prescription.rejectionReason = rejectionReason;
  await prescription.save();

  res.json({ success: true, message: `Prescription ${status}`, data: { prescription } });
}));

router.delete('/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const prescription = await Prescription.findById(req.params.id);
  if (!prescription) throw new NotFoundError('Prescription not found');

  if (prescription.userId !== req.user!.userId && req.user!.role !== UserRole.ADMIN_SUPER) {
    throw new ForbiddenError('Access denied');
  }

  await prescription.deleteOne();
  res.json({ success: true, message: 'Prescription deleted' });
}));

export default router;
