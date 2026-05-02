// @ts-nocheck
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import pkg from 'agora-access-token';

import { Order } from '../models/index.js';
import { asyncHandler, BadRequestError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import config from '../config/index.js';
import { UserRole } from '../types/index.js';
import { emitToUser, emitToOrder } from '../services/socket.js';

const router = Router();
const { RtcTokenBuilder, RtcRole } = pkg as any;

/**
 * @route   POST /api/v1/communication/call/token
 * @desc    Get Agora token for video call
 */
router.post('/call/token', authenticate, [
  body('channelName').notEmpty(),
  body('role').optional().isIn(['publisher', 'subscriber']),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  if (!config.agora.appId || !config.agora.appCertificate) {
    throw new BadRequestError('Video calling is not configured');
  }

  const { channelName, role = 'publisher' } = req.body;

  // Generate UID from user ID
  const uid = Math.abs(req.user!.userId.split('-').join('').slice(0, 8).split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 100000;

  const rtcRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  const expireTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour

  const token = RtcTokenBuilder.buildTokenWithUid(
    config.agora.appId,
    config.agora.appCertificate,
    channelName,
    uid,
    rtcRole,
    expireTime
  );

  res.json({
    success: true,
    data: {
      token,
      uid,
      channelName,
      appId: config.agora.appId,
      expiresAt: new Date(expireTime * 1000).toISOString(),
    },
  });
}));

/**
 * @route   POST /api/v1/communication/call/initiate
 * @desc    Initiate a call for an order
 */
router.post('/call/initiate', authenticate, authorize(UserRole.PHARMACIST, UserRole.SENIOR_PHARMACIST, UserRole.ADMIN_SUPER, UserRole.CUSTOMER), [
  body('orderId').isUUID(),
  body('type').isIn(['video', 'audio']),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  const { orderId, type } = req.body;

  const order = await Order.findById(orderId).populate({ path: 'user' });
  if (!order) throw new NotFoundError('Order not found');

  const channelName = `order-${orderId}`;

  // Generate tokens for both parties
  const pharmacistUid = Math.abs(req.user!.userId.split('-').join('').slice(0, 8).split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 100000;
  const customerUid = Math.abs(order.userId.split('-').join('').slice(0, 8).split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 100000;

  const expireTime = Math.floor(Date.now() / 1000) + 3600;

  let pharmacistToken = '';
  let customerToken = '';

  if (config.agora.appId && config.agora.appCertificate) {
    pharmacistToken = RtcTokenBuilder.buildTokenWithUid(
      config.agora.appId,
      config.agora.appCertificate,
      channelName,
      pharmacistUid,
      RtcRole.PUBLISHER,
      expireTime
    );

    customerToken = RtcTokenBuilder.buildTokenWithUid(
      config.agora.appId,
      config.agora.appCertificate,
      channelName,
      customerUid,
      RtcRole.PUBLISHER,
      expireTime
    );
  }

  const initiatorIsCustomer = req.user!.role === UserRole.CUSTOMER;
  const recipientUserId = initiatorIsCustomer ? (order.reviewedBy || '') : order.userId;
  const recipientToken = initiatorIsCustomer ? pharmacistToken : customerToken;
  const recipientUid = initiatorIsCustomer ? pharmacistUid : customerUid;
  const callerName = initiatorIsCustomer ? 'JetMed Customer' : 'JetMed Pharmacist';

  // Notify recipient about incoming call
  const io = req.app.get('io');
  if (io && recipientUserId) {
    emitToUser(io, recipientUserId, 'call:incoming', {
      orderId,
      orderNumber: order.orderNumber,
      callType: type,
      channelName,
      token: recipientToken,
      uid: recipientUid,
      appId: config.agora.appId,
      callerName,
    });
  }

  res.json({
    success: true,
    message: 'Call initiated',
    data: {
      channelName,
      token: pharmacistToken,
      uid: pharmacistUid,
      appId: config.agora.appId,
    },
  });
}));

/**
 * @route   POST /api/v1/communication/call/end
 * @desc    End a call
 */
router.post('/call/end', authenticate, [
  body('channelName').notEmpty(),
  body('duration').optional().isInt({ min: 0 }),
], asyncHandler(async (req: Request, res: Response) => {
  const { channelName, duration, notes } = req.body;

  // Extract order ID from channel name
  const orderId = channelName.replace('order-', '');

  const order = await Order.findById(orderId);
  if (order) {
    // Log call details
    const callLog = {
      startedAt: new Date(Date.now() - (duration || 0) * 1000),
      endedAt: new Date(),
      duration: duration || 0,
      notes,
      initiatedBy: req.user!.userId,
    };

    // Update order with call log (assuming we have a callLogs field)
    const existingLogs = order.callLogs || [];
    order.callLogs = [...existingLogs, callLog];
    await order.save();
  }

  // Notify all participants
  const io = req.app.get('io');
  if (io && order) {
    emitToOrder(io, orderId, 'call:ended', { channelName, duration });
  }

  res.json({ success: true, message: 'Call ended' });
}));

/**
 * @route   POST /api/v1/communication/chat/send
 * @desc    Send chat message
 */
router.post('/chat/send', authenticate, [
  body('orderId').isUUID(),
  body('message').notEmpty(),
  body('type').optional().isIn(['text', 'image', 'file']),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  const { orderId, message, type = 'text', attachmentUrl } = req.body;

  const order = await Order.findById(orderId);
  if (!order) throw new NotFoundError('Order not found');

  // Check authorization
  const allowedRoles = [UserRole.PHARMACIST, UserRole.SENIOR_PHARMACIST, UserRole.ADMIN_SUPER, UserRole.ADMIN_SUPPORT];
  if (order.userId !== req.user!.userId && !allowedRoles.includes(req.user!.role as UserRole)) {
    throw new ForbiddenError('Access denied');
  }

  const chatMessage = {
    id: `msg-${Date.now()}`,
    senderId: req.user!.userId,
    senderRole: req.user!.role,
    message,
    type,
    attachmentUrl,
    timestamp: new Date().toISOString(),
    read: false,
  };

  // Add to order chat history
  const existingChat = order.chatHistory || [];
  order.chatHistory = [...existingChat, chatMessage];
  await order.save();

  // Send real-time notification
  const io = req.app.get('io');
  if (io) {
    emitToOrder(io, orderId, 'chat:message', chatMessage);
  }

  res.json({ success: true, data: { message: chatMessage } });
}));

/**
 * @route   GET /api/v1/communication/chat/:orderId
 * @desc    Get chat history for an order
 */
router.get('/chat/:orderId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) throw new NotFoundError('Order not found');

  const allowedRoles = [UserRole.PHARMACIST, UserRole.SENIOR_PHARMACIST, UserRole.ADMIN_SUPER, UserRole.ADMIN_SUPPORT];
  if (order.userId !== req.user!.userId && !allowedRoles.includes(req.user!.role as UserRole)) {
    throw new ForbiddenError('Access denied');
  }

  res.json({ success: true, data: { messages: order.chatHistory || [] } });
}));

/**
 * @route   POST /api/v1/communication/chat/:orderId/read
 * @desc    Mark messages as read
 */
router.post('/chat/:orderId/read', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) throw new NotFoundError('Order not found');

  // Mark all messages not from current user as read
  const updatedChat = (order.chatHistory || []).map((msg: any) => {
    if (msg.senderId !== req.user!.userId) {
      return { ...msg, read: true };
    }
    return msg;
  });

  order.chatHistory = updatedChat;
  await order.save();

  res.json({ success: true, message: 'Messages marked as read' });
}));

export default router;
