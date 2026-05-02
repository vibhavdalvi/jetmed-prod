// @ts-nocheck
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

import config from '../config/index.js';
import { User, UserProfile, UserMedicalInfo, Wallet } from '../models/index.js';
import { asyncHandler, BadRequestError, UnauthorizedError, ConflictError } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';
import { cacheSet, cacheGet, cacheDelete } from '../config/redis.js';
import { UserRole, IJwtPayload } from '../types/index.js';
import { recordActivity, requestAuditContext } from '../services/activityLog.js';

const router = Router();

// Helper function to generate tokens
const generateTokens = (user: User) => {
  const payload: IJwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });

  return { accessToken, refreshToken };
};

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('phone').optional().isMobilePhone('any').withMessage('Invalid phone number'),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  registerValidation,
  asyncHandler(async (req: Request, res: Response) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', errors.array());
    }

    const { email, password, firstName, lastName, phone, dateOfBirth, gender } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Check if phone is already used
    if (phone) {
      const existingPhone = await User.findOne({ where: { phone } });
      if (existingPhone) {
        throw new ConflictError('Phone number is already registered');
      }
    }

    // Create user
    const user = await User.create({
      email,
      password,
      phone,
      role: UserRole.CUSTOMER,
      isActive: true,
      isVerified: false,
      twoFactorEnabled: false,
    });

    // Create user profile
    await UserProfile.create({
      userId: user.id,
      firstName,
      lastName,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      gender,
      timezone: 'America/New_York',
    });

    // Create empty medical info
    await UserMedicalInfo.create({
      userId: user.id,
      allergies: [],
      currentMedications: [],
      chronicConditions: [],
    });

    // Create wallet
    await Wallet.create({
      userId: user.id,
      balance: 0,
      currency: 'USD',
    });

    // Generate tokens
    const tokens = generateTokens(user);

    // Store refresh token in Redis
    await cacheSet(`refresh:${user.id}`, tokens.refreshToken, 7 * 24 * 60 * 60);

    // Set cookies
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: config.app.env === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: config.app.env === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    void recordActivity({
      action: 'user.registered',
      entityType: 'user',
      entityId: user.id,
      userId: user.id,
      role: user.role,
      metadata: { role: user.role },
      ...requestAuditContext(req),
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: user.toJSON(),
        tokens,
      },
    });
  })
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  loginValidation,
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', errors.array());
    }

    const { email, password, rememberMe } = req.body;

    // Check login attempts
    const attemptsKey = `login_attempts:${email}`;
    const attempts = await cacheGet(attemptsKey);
    
    if (attempts && parseInt(attempts) >= config.loginSecurity.maxAttempts) {
      throw new BadRequestError(
        `Account locked due to too many failed attempts. Try again in ${config.loginSecurity.lockoutMinutes} minutes.`
      );
    }

    // Find user
    const user = await User.findOne({
      where: { email },
      include: [
        { model: UserProfile, as: 'profile' },
      ],
    });

    if (!user) {
      // Increment failed attempts
      await cacheSet(attemptsKey, String((parseInt(attempts || '0') + 1)), config.loginSecurity.lockoutMinutes * 60);
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await cacheSet(attemptsKey, String((parseInt(attempts || '0') + 1)), config.loginSecurity.lockoutMinutes * 60);
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedError('Account is deactivated');
    }

    // Clear login attempts on success
    await cacheDelete(attemptsKey);

    // Generate tokens
    const tokens = generateTokens(user);

    // Store refresh token
    const refreshExpiry = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;
    await cacheSet(`refresh:${user.id}`, tokens.refreshToken, refreshExpiry);

    // Set cookies
    const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: config.app.env === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: config.app.env === 'production',
      sameSite: 'strict',
      maxAge: cookieMaxAge,
    });

    void recordActivity({
      action: 'user.login',
      entityType: 'user',
      entityId: user.id,
      userId: user.id,
      role: user.role,
      metadata: { rememberMe: Boolean(rememberMe) },
      ...requestAuditContext(req),
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toJSON(),
        tokens,
        requiresTwoFactor: user.twoFactorEnabled,
      },
    });
  })
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    // Remove refresh token from Redis
    await cacheDelete(`refresh:${req.user!.userId}`);

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.clearCookie('twoFactorVerified');

    res.json({
      success: true,
      message: 'Logout successful',
    });
  })
);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token not provided');
    }

    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as IJwtPayload;

      // Check if refresh token is in Redis
      const storedToken = await cacheGet(`refresh:${decoded.userId}`);
      if (!storedToken || storedToken !== refreshToken) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Get user
      const user = await User.findByPk(decoded.userId);
      if (!user || !user.isActive) {
        throw new UnauthorizedError('User not found or inactive');
      }

      // Generate new tokens
      const tokens = generateTokens(user);

      // Update stored refresh token
      await cacheSet(`refresh:${user.id}`, tokens.refreshToken, 7 * 24 * 60 * 60);

      // Set new cookies
      res.cookie('accessToken', tokens.accessToken, {
        httpOnly: true,
        secure: config.app.env === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
      });

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: config.app.env === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({
        success: true,
        message: 'Token refreshed',
        data: { tokens },
      });
    } catch (error) {
      throw new UnauthorizedError('Invalid refresh token');
    }
  })
);

/**
 * @route   POST /api/v1/auth/2fa/setup
 * @desc    Setup two-factor authentication
 * @access  Private
 */
router.post(
  '/2fa/setup',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findByPk(req.user!.userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `${config.twoFactor.appName} (${user.email})`,
      length: 32,
    });

    // Store secret temporarily
    await cacheSet(`2fa_setup:${user.id}`, secret.base32, 600); // 10 minutes

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    res.json({
      success: true,
      message: 'Scan the QR code with your authenticator app',
      data: {
        qrCode: qrCodeUrl,
        secret: secret.base32,
      },
    });
  })
);

/**
 * @route   POST /api/v1/auth/2fa/verify
 * @desc    Verify and enable two-factor authentication
 * @access  Private
 */
router.post(
  '/2fa/verify',
  authenticate,
  body('token').isLength({ min: 6, max: 6 }).withMessage('Invalid token'),
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', errors.array());
    }

    const { token } = req.body;
    const user = await User.findByPk(req.user!.userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Get stored secret
    const secret = await cacheGet(`2fa_setup:${user.id}`);
    if (!secret) {
      throw new BadRequestError('2FA setup expired. Please start again.');
    }

    // Verify token
    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!isValid) {
      throw new BadRequestError('Invalid verification code');
    }

    // Enable 2FA
    user.twoFactorEnabled = true;
    user.twoFactorSecret = secret;
    await user.save();

    // Clean up
    await cacheDelete(`2fa_setup:${user.id}`);

    res.json({
      success: true,
      message: 'Two-factor authentication enabled',
    });
  })
);

/**
 * @route   POST /api/v1/auth/2fa/validate
 * @desc    Validate 2FA token on login
 * @access  Public
 */
router.post(
  '/2fa/validate',
  body('userId').isUUID().withMessage('Invalid user ID'),
  body('token').isLength({ min: 6, max: 6 }).withMessage('Invalid token'),
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', errors.array());
    }

    const { userId, token } = req.body;
    const user = await User.findByPk(userId);
    if (!user || !user.twoFactorSecret) {
      throw new UnauthorizedError('Invalid request');
    }

    // Verify token
    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!isValid) {
      throw new BadRequestError('Invalid verification code');
    }

    // Set 2FA verified cookie
    res.cookie('twoFactorVerified', 'true', {
      httpOnly: true,
      secure: config.app.env === 'production',
      sameSite: 'strict',
      maxAge: config.session.timeoutMinutes * 60 * 1000,
    });

    res.json({
      success: true,
      message: 'Two-factor authentication verified',
    });
  })
);

/**
 * @route   POST /api/v1/auth/2fa/disable
 * @desc    Disable two-factor authentication
 * @access  Private
 */
router.post(
  '/2fa/disable',
  authenticate,
  body('password').notEmpty().withMessage('Password is required'),
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', errors.array());
    }

    const { password } = req.body;
    const user = await User.findByPk(req.user!.userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new BadRequestError('Invalid password');
    }

    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Two-factor authentication disabled',
    });
  })
);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findByPk(req.user!.userId, {
      include: [
        { model: UserProfile, as: 'profile' },
        { model: UserMedicalInfo, as: 'medicalInfo' },
        { model: Wallet, as: 'wallet' },
      ],
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    res.json({
      success: true,
      data: { user: user.toJSON() },
    });
  })
);

export default router;
