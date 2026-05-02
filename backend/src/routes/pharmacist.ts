// @ts-nocheck
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { Op } from 'sequelize';

import { Order, OrderItem, User, UserProfile, Prescription, Medicine, Address } from '../models/index.js';
import { asyncHandler, BadRequestError, NotFoundError } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { getFileUrl } from '../middleware/upload.js';
import { UserRole, OrderStatus, PrescriptionStatus } from '../types/index.js';
import { emitToUser, emitToWarehouse } from '../services/socket.js';

const router = Router();

// Middleware to restrict to pharmacist roles
const pharmacistAuth = [authenticate, authorize(UserRole.PHARMACIST, UserRole.SENIOR_PHARMACIST, UserRole.ADMIN_SUPER)];

/**
 * @route   GET /api/v1/pharmacist/queue
 * @desc    Get orders pending prescription review
 */
router.get('/queue', ...pharmacistAuth, asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', limit = '20', urgency } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 20, 50);

  const where: any = {
    status: { [Op.in]: [OrderStatus.PLACED, OrderStatus.PENDING_REVIEW] },
    prescriptionRequired: true,
  };
  if (urgency) where.urgencyLevel = urgency;

  const { count, rows: orders } = await Order.findAndCountAll({
    where,
    order: [['urgencyLevel', 'DESC'], ['createdAt', 'ASC']],
    limit: limitNum,
    offset: (pageNum - 1) * limitNum,
    include: [
      { model: User, as: 'user', include: [{ model: UserProfile, as: 'profile' }] },
      { model: Address, as: 'deliveryAddress' },
    ],
  });

  const prescriptionIds = Array.from(
    new Set(
      orders.flatMap((order: any) => (Array.isArray(order.prescriptionIds) ? order.prescriptionIds : []))
    )
  );
  const prescriptions = prescriptionIds.length
    ? await Prescription.findAll({
        where: { id: { [Op.in]: prescriptionIds } },
        attributes: ['id', 'filePath'],
      })
    : [];
  const prescriptionImageMap = new Map(
    prescriptions.map((prescription: any) => [prescription.id, prescription.filePath ? getFileUrl(prescription.filePath) : null])
  );
  const ordersWithPrescriptionImages = orders.map((order: any) => {
    const ids = Array.isArray(order.prescriptionIds) ? order.prescriptionIds : [];
    const prescriptionImages = ids
      .map((id: string) => prescriptionImageMap.get(id))
      .filter(Boolean);
    return {
      ...order.toJSON(),
      prescriptionImages,
    };
  });

  res.json({
    success: true,
    data: { orders: ordersWithPrescriptionImages, total: count, page: pageNum, totalPages: Math.ceil(count / limitNum) },
  });
}));

/**
 * @route   GET /api/v1/pharmacist/order/:id
 * @desc    Get order details for review
 */
router.get('/order/:id', ...pharmacistAuth, asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findByPk(req.params.id, {
    include: [
      { model: User, as: 'user', include: [{ model: UserProfile, as: 'profile' }] },
      { model: OrderItem, as: 'orderItems', include: [{ model: Medicine, as: 'medicine' }] },
      { model: Address, as: 'deliveryAddress' },
    ],
  });

  if (!order) throw new NotFoundError('Order not found');

  // Get associated prescriptions (include public URLs for review UI)
  const prescriptions = order.prescriptionIds?.length > 0
    ? await Prescription.findAll({ where: { id: { [Op.in]: order.prescriptionIds } } })
    : [];
  const prescriptionsForClient = prescriptions.map((p: any) => {
    const plain = p.toJSON();
    return {
      ...plain,
      imageUrl: plain.filePath ? getFileUrl(plain.filePath) : null,
    };
  });

  res.json({ success: true, data: { order, prescriptions: prescriptionsForClient } });
}));

/**
 * @route   POST /api/v1/pharmacist/order/:id/approve
 * @desc    Approve order after prescription review
 */
router.post('/order/:id/approve', ...pharmacistAuth, [
  body('notes').optional().isString(),
], asyncHandler(async (req: Request, res: Response) => {
  const { notes, note, substitutions } = req.body;

  const order = await Order.findByPk(req.params.id);
  if (!order) throw new NotFoundError('Order not found');

  if (![OrderStatus.PLACED, OrderStatus.PENDING_REVIEW].includes(order.status)) {
    throw new BadRequestError('Order cannot be approved in current status');
  }

  await order.update({
    status: OrderStatus.APPROVED,
    reviewedBy: req.user!.userId,
    reviewedAt: new Date(),
    pharmacistNotes: notes || note,
    substitutions: substitutions || [],
  });

  // Update associated prescriptions
  if (order.prescriptionIds?.length > 0) {
    await Prescription.update(
      { status: PrescriptionStatus.APPROVED, verifiedBy: req.user!.userId, verifiedAt: new Date() },
      { where: { id: { [Op.in]: order.prescriptionIds } } }
    );
  }

  // Notify warehouse and customer
  const io = req.app.get('io');
  if (io) {
    emitToWarehouse(io, 'order:approved', { orderId: order.id, orderNumber: order.orderNumber });
    emitToUser(io, order.userId, 'order:approved', { orderId: order.id, orderNumber: order.orderNumber });
  }

  res.json({ success: true, message: 'Order approved', data: { order } });
}));

/**
 * @route   POST /api/v1/pharmacist/order/:id/reject
 * @desc    Reject order
 */
router.post('/order/:id/reject', ...pharmacistAuth, [
  body('reason').notEmpty().withMessage('Rejection reason is required'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  const { reason, refundRequired } = req.body;

  const order = await Order.findByPk(req.params.id);
  if (!order) throw new NotFoundError('Order not found');

  await order.update({
    status: OrderStatus.REJECTED,
    reviewedBy: req.user!.userId,
    reviewedAt: new Date(),
    pharmacistNotes: reason,
  });

  // Update prescriptions
  if (order.prescriptionIds?.length > 0) {
    await Prescription.update(
      { status: PrescriptionStatus.REJECTED, rejectionReason: reason },
      { where: { id: { [Op.in]: order.prescriptionIds } } }
    );
  }

  // Notify customer
  const io = req.app.get('io');
  if (io) {
    emitToUser(io, order.userId, 'order:rejected', { orderId: order.id, orderNumber: order.orderNumber, reason });
  }

  // TODO: Process refund if needed

  res.json({ success: true, message: 'Order rejected', data: { order } });
}));

/**
 * @route   POST /api/v1/pharmacist/order/:id/request-info
 * @desc    Request additional info from customer
 */
router.post('/order/:id/request-info', ...pharmacistAuth, [
  body('message').notEmpty(),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  const { message } = req.body;

  const order = await Order.findByPk(req.params.id);
  if (!order) throw new NotFoundError('Order not found');

  await order.update({
    status: OrderStatus.PENDING_REVIEW,
    pharmacistNotes: message,
  });

  const io = req.app.get('io');
  if (io) {
    emitToUser(io, order.userId, 'order:info_requested', { orderId: order.id, orderNumber: order.orderNumber, message });
  }

  res.json({ success: true, message: 'Information requested from customer' });
}));

router.post('/order/:id/escalate', ...pharmacistAuth, [
  body('note').optional().isString(),
], asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findByPk(req.params.id);
  if (!order) throw new NotFoundError('Order not found');

  const note = req.body?.note || 'Escalated to senior pharmacist';
  await order.update({
    status: OrderStatus.PENDING_REVIEW,
    pharmacistNotes: `ESCALATED: ${note}`,
  });

  const io = req.app.get('io');
  if (io) {
    io.to(`role:${UserRole.SENIOR_PHARMACIST}`).emit('pharmacist:escalation', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      note,
    });
  }

  res.json({ success: true, message: 'Order escalated', data: { order } });
}));

/**
 * @route   GET /api/v1/pharmacist/stats
 * @desc    Get pharmacist stats
 */
router.get('/stats', ...pharmacistAuth, asyncHandler(async (req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pendingCount = await Order.count({
    where: { status: { [Op.in]: [OrderStatus.PLACED, OrderStatus.PENDING_REVIEW] }, prescriptionRequired: true },
  });

  const reviewedToday = await Order.count({
    where: { reviewedBy: req.user!.userId, reviewedAt: { [Op.gte]: today } },
  });

  const approvedToday = await Order.count({
    where: { reviewedBy: req.user!.userId, reviewedAt: { [Op.gte]: today }, status: OrderStatus.APPROVED },
  });

  res.json({
    success: true,
    data: { pendingCount, reviewedToday, approvedToday, rejectedToday: reviewedToday - approvedToday },
  });
}));

router.get('/queue/stats', ...pharmacistAuth, asyncHandler(async (req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const total = await Order.count({
    where: { status: { [Op.in]: [OrderStatus.PLACED, OrderStatus.PENDING_REVIEW] }, prescriptionRequired: true },
  });
  const urgent = await Order.count({
    where: {
      status: { [Op.in]: [OrderStatus.PLACED, OrderStatus.PENDING_REVIEW] },
      prescriptionRequired: true,
      urgencyLevel: 'urgent',
    },
  });
  const avgWait = await Order.findAll({
    where: { status: { [Op.in]: [OrderStatus.PLACED, OrderStatus.PENDING_REVIEW] }, prescriptionRequired: true },
    attributes: ['createdAt'],
  });
  const avgWaitTime = avgWait.length
    ? Math.round(
        avgWait.reduce((sum: number, order: any) => {
          return sum + Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
        }, 0) / avgWait.length
      )
    : 0;

  const reviewedToday = await Order.count({
    where: { reviewedBy: req.user!.userId, reviewedAt: { [Op.gte]: today } },
  });
  const infoRequested = await Order.count({
    where: { status: OrderStatus.PENDING_REVIEW, pharmacistNotes: { [Op.like]: '%info%' } },
  });

  res.json({
    success: true,
    data: {
      total,
      urgent,
      high: 0,
      normal: Math.max(total - urgent, 0),
      inReview: reviewedToday,
      infoRequested,
      avgWaitTime,
    },
  });
}));

export default router;
