import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { sendOTP, verifyOTP, sendOrderNotification } from '../services/smsService.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { User } from '../models/index.js';
import { UserRole } from '../types/index.js';

const router = Router();

/**
 * @route   POST /api/v1/sms/send-otp
 * @desc    Send OTP to phone number
 * @access  Public
 */
router.post(
  '/send-otp',
  [
    body('phone')
      .notEmpty().withMessage('Phone number is required')
      .matches(/^\+?1?\d{10,14}$/).withMessage('Invalid phone number'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { phone } = req.body;
      const result = await sendOTP(phone);

      return res.status(result.success ? 200 : 400).json({
        success: result.success,
        message: result.message,
      });
    } catch (error) {
      console.error('Send OTP error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification code',
      });
    }
  }
);

/**
 * @route   POST /api/v1/sms/verify-otp
 * @desc    Verify OTP code
 * @access  Public
 */
router.post(
  '/verify-otp',
  [
    body('phone')
      .notEmpty().withMessage('Phone number is required')
      .matches(/^\+?1?\d{10,14}$/).withMessage('Invalid phone number'),
    body('code')
      .notEmpty().withMessage('Verification code is required')
      .isLength({ min: 6, max: 6 }).withMessage('Code must be 6 digits'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { phone, code } = req.body;
      const result = await verifyOTP(phone, code);

      return res.status(result.success ? 200 : 400).json({
        success: result.success,
        message: result.message,
        verified: result.success,
      });
    } catch (error) {
      console.error('Verify OTP error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify code',
      });
    }
  }
);

/**
 * @route   POST /api/v1/sms/verify-and-update-phone
 * @desc    Verify OTP and update user's phone number
 * @access  Private
 */
router.post(
  '/verify-and-update-phone',
  authenticate,
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('code').notEmpty().withMessage('Verification code is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { phone, code } = req.body;
      const userId = req.user!.userId;

      // Verify OTP
      const verifyResult = await verifyOTP(phone, code);
      if (!verifyResult.success) {
        return res.status(400).json({
          success: false,
          message: verifyResult.message,
        });
      }

      // Update user phone
      await User.update(
        { phone },
        { where: { id: userId } }
      );

      return res.json({
        success: true,
        message: 'Phone number verified and updated successfully',
      });
    } catch (error) {
      console.error('Verify and update phone error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update phone number',
      });
    }
  }
);

/**
 * @route   POST /api/v1/sms/test-notification
 * @desc    Test SMS notification (Admin only)
 * @access  Private (Admin)
 */
router.post(
  '/test-notification',
  authenticate,
  authorize(UserRole.ADMIN_SUPER),
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('template').notEmpty().withMessage('Template is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const { phone, template, ...params } = req.body;

      // Extract template parameters as array
      const args = Object.values(params).filter((v) => typeof v === 'string') as string[];

      const result = await sendOrderNotification(phone, template, ...args);

      return res.json({
        success: result.success,
        message: result.success ? 'Test notification sent' : 'Failed to send notification',
      });
    } catch (error) {
      console.error('Test notification error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send test notification',
      });
    }
  }
);

export default router;