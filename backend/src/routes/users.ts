import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';

import { User, UserProfile, UserMedicalInfo, Address, Prescription, Wallet } from '../models/index.js';
import { asyncHandler, BadRequestError, NotFoundError } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';
import { uploadAvatar, getFileUrl } from '../middleware/upload.js';

const router = Router();

/**
 * @route   GET /api/v1/users/me
 * @desc    Get current user profile
 */
router.get('/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.userId)
    .populate('profile')
    .populate('medicalInfo')
    .populate('wallet');
  if (!user) throw new NotFoundError('User not found');
  res.json({ success: true, data: { user } });
}));

/**
 * @route   PUT /api/v1/users/me
 * @desc    Update profile
 */
router.put('/me', authenticate, uploadAvatar, asyncHandler(async (req: Request, res: Response) => {
  const { firstName, lastName, dateOfBirth, gender, emergencyContact, preferences } = req.body;
  const user = await User.findById(req.user!.userId);
  if (!user) throw new NotFoundError('User not found');

  let profile = await UserProfile.findOne({ userId: user.id });
  const profileData: Record<string, unknown> = {
    firstName,
    lastName,
    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
    gender,
    emergencyContact,
    preferences,
  };
  if (req.file) profileData.avatar = getFileUrl(req.file.path);

  if (profile) {
    Object.assign(profile, profileData);
    await profile.save();
  } else {
    profile = await UserProfile.create({
      userId: user.id,
      firstName: firstName || 'Customer',
      lastName: lastName || 'User',
      timezone: 'America/New_York',
      ...profileData,
    });
  }

  res.json({ success: true, message: 'Profile updated', data: { profile } });
}));

/**
 * @route   GET /api/v1/users/me/medical-info
 * @desc    Get medical profile details
 */
router.get('/me/medical-info', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const medicalInfo = await UserMedicalInfo.findOne({ userId: req.user!.userId });
  res.json({ success: true, data: { medicalInfo } });
}));

/**
 * @route   PUT /api/v1/users/me/medical-info
 * @desc    Update medical profile details
 */
router.put('/me/medical-info', authenticate, [
  body('allergies').optional().isArray(),
  body('currentMedications').optional().isArray(),
  body('chronicConditions').optional().isArray(),
  body('bloodType').optional({ nullable: true }).isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  body('emergencyContactName').optional({ nullable: true }).isString(),
  body('emergencyContactPhone').optional({ nullable: true }).isString(),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  const payload = {
    allergies: Array.isArray(req.body.allergies) ? req.body.allergies : [],
    currentMedications: Array.isArray(req.body.currentMedications) ? req.body.currentMedications : [],
    chronicConditions: Array.isArray(req.body.chronicConditions) ? req.body.chronicConditions : [],
    bloodType: req.body.bloodType || undefined,
    emergencyContactName: req.body.emergencyContactName || undefined,
    emergencyContactPhone: req.body.emergencyContactPhone || undefined,
  };

  let medicalInfo = await UserMedicalInfo.findOne({ userId: req.user!.userId });
  if (medicalInfo) {
    Object.assign(medicalInfo, payload);
    await medicalInfo.save();
  } else {
    medicalInfo = await UserMedicalInfo.create({ userId: req.user!.userId, ...payload });
  }

  res.json({ success: true, message: 'Medical info updated', data: { medicalInfo } });
}));

/**
 * @route   GET /api/v1/users/me/notifications
 * @desc    Get notification preferences
 */
router.get('/me/notifications', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const profile = await UserProfile.findOne({ userId: req.user!.userId });
  const preferences = (profile as { preferences?: Record<string, unknown> } | null)?.preferences || {};
  res.json({ success: true, data: { notifications: preferences } });
}));

/**
 * @route   PUT /api/v1/users/me/notifications
 * @desc    Update notification preferences
 */
router.put('/me/notifications', authenticate, [
  body('inApp').optional().isBoolean(),
  body('push').optional().isBoolean(),
  body('email').optional().isBoolean(),
  body('sms').optional().isBoolean(),
  body('whatsapp').optional().isBoolean(),
  body('orderUpdates').optional().isBoolean(),
  body('promotions').optional().isBoolean(),
  body('pharmacistMessages').optional().isBoolean(),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  let profile = await UserProfile.findOne({ userId: req.user!.userId });
  if (!profile) {
    profile = await UserProfile.create({
      userId: req.user!.userId,
      firstName: 'Customer',
      lastName: 'User',
      timezone: 'America/New_York',
    });
  }

  const existingPreferences =
    (profile as unknown as { preferences?: Record<string, unknown> }).preferences || {};
  const nextPreferences = {
    ...existingPreferences,
    ...req.body,
  };

  (profile as unknown as { preferences: Record<string, unknown> }).preferences = nextPreferences;
  await profile.save();

  res.json({ success: true, message: 'Notification preferences updated', data: { notifications: nextPreferences } });
}));

/**
 * @route   PUT /api/v1/users/me/password
 * @desc    Change password
 */
router.put('/me/password', authenticate, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user!.userId).select('+password');
  if (!user) throw new NotFoundError('User not found');

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw new BadRequestError('Current password is incorrect');

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password changed' });
}));

/**
 * @route   GET /api/v1/users/me/addresses
 */
router.get('/me/addresses', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const addresses = await Address.find({ userId: req.user!.userId })
    .sort({ isDefault: -1, createdAt: -1 })
    .lean();
  res.json({ success: true, data: { addresses } });
}));

/**
 * @route   POST /api/v1/users/me/addresses
 */
router.post('/me/addresses', authenticate, [
  body('label').trim().notEmpty(),
  body('streetAddress').trim().notEmpty().withMessage('Street address is required'),
  body('city').trim().notEmpty(),
  body('state').trim().notEmpty(),
  body('zipCode').trim().notEmpty(),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  const { label, streetAddress, apartment, city, state, zipCode, country, latitude, longitude, isDefault, deliveryInstructions } = req.body;

  if (isDefault) {
    await Address.updateMany({ userId: req.user!.userId }, { $set: { isDefault: false } });
  }

  const address = await Address.create({
    userId: req.user!.userId,
    label,
    streetAddress,
    apartment,
    city,
    state,
    zipCode,
    country: country || 'United States',
    latitude,
    longitude,
    isDefault: isDefault || false,
    deliveryInstructions,
  });

  res.status(201).json({ success: true, message: 'Address added', data: { address } });
}));

/**
 * @route   PUT /api/v1/users/me/addresses/:id
 */
router.put('/me/addresses/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const address = await Address.findOne({ _id: req.params.id, userId: req.user!.userId });
  if (!address) throw new NotFoundError('Address not found');

  if (req.body.isDefault) {
    await Address.updateMany({ userId: req.user!.userId }, { $set: { isDefault: false } });
  }

  Object.assign(address, req.body);
  await address.save();
  res.json({ success: true, message: 'Address updated', data: { address } });
}));

/**
 * @route   DELETE /api/v1/users/me/addresses/:id
 */
router.delete('/me/addresses/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const address = await Address.findOne({ _id: req.params.id, userId: req.user!.userId });
  if (!address) throw new NotFoundError('Address not found');
  await address.deleteOne();
  res.json({ success: true, message: 'Address deleted' });
}));

/**
 * @route   GET /api/v1/users/me/prescriptions
 */
router.get('/me/prescriptions', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const prescriptions = await Prescription.find({ userId: req.user!.userId }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: { prescriptions } });
}));

export default router;
