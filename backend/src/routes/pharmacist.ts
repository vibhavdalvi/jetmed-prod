// @ts-nocheck
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';

import { Order, Prescription } from '../models/index.js';
import { asyncHandler, BadRequestError, NotFoundError } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { getFileUrl } from '../middleware/upload.js';
import { UserRole, OrderStatus, PrescriptionStatus } from '../types/index.js';
import { emitToUser, emitToWarehouse } from '../services/socket.js';
import { M } from '../utils/mongoQuery.js';
import { rxInsensitive } from '../utils/mongoSchema.js';

const router = Router();

const pharmacistAuth = [authenticate, authorize(UserRole.PHARMACIST, UserRole.SENIOR_PHARMACIST, UserRole.ADMIN_SUPER)];

const orderDetailPopulate = [
  { path: 'user', populate: { path: 'profile' } },
  { path: 'orderItems', populate: { path: 'medicine' } },
  { path: 'deliveryAddress' },
];

router.get('/queue', ...pharmacistAuth, asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', limit = '20', urgency } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 20, 50);

  const filter: Record<string, unknown> = {
    status: M.in([OrderStatus.PLACED, OrderStatus.PENDING_REVIEW]),
    prescriptionRequired: true,
  };
  if (urgency) filter.urgencyLevel = urgency;

  const count = await Order.countDocuments(filter);
  const orders = await Order.find(filter)
    .sort({ urgencyLevel: -1, createdAt: 1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)
    .populate([
      { path: 'user', populate: { path: 'profile' } },
      { path: 'deliveryAddress' },
    ]);

  const prescriptionIds = Array.from(
    new Set(orders.flatMap((order: any) => (Array.isArray(order.prescriptionIds) ? order.prescriptionIds : [])))
  );
  const prescriptions = prescriptionIds.length
    ? await Prescription.find({ _id: M.in(prescriptionIds) }).select('filePath').lean()
    : [];
  const prescriptionImageMap = new Map(
    prescriptions.map((p: any) => [String(p._id), p.filePath ? getFileUrl(p.filePath) : null])
  );
  const ordersWithPrescriptionImages = orders.map((order: any) => {
    const ids = Array.isArray(order.prescriptionIds) ? order.prescriptionIds : [];
    const prescriptionImages = ids.map((id: string) => prescriptionImageMap.get(id)).filter(Boolean);
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

router.get('/order/:id', ...pharmacistAuth, asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findOne({
    $or: [{ _id: req.params.id }, { orderNumber: req.params.id }],
  }).populate(orderDetailPopulate);

  if (!order) throw new NotFoundError('Order not found');

  const prescriptions =
    order.prescriptionIds?.length > 0
      ? await Prescription.find({ _id: M.in(order.prescriptionIds) })
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

router.post('/order/:id/approve', ...pharmacistAuth, [body('notes').optional().isString()], asyncHandler(async (req: Request, res: Response) => {
  const { notes, note, substitutions } = req.body;

  const order = await Order.findById(req.params.id);
  if (!order) throw new NotFoundError('Order not found');

  if (![OrderStatus.PLACED, OrderStatus.PENDING_REVIEW].includes(order.status)) {
    throw new BadRequestError('Order cannot be approved in current status');
  }

  order.status = OrderStatus.APPROVED;
  order.reviewedBy = req.user!.userId;
  order.reviewedAt = new Date();
  order.pharmacistNotes = notes || note;
  await order.save();

  if (order.prescriptionIds?.length > 0) {
    await Prescription.updateMany(
      { _id: M.in(order.prescriptionIds) },
      {
        $set: {
          status: PrescriptionStatus.APPROVED,
          verifiedBy: req.user!.userId,
          verifiedAt: new Date(),
        },
      }
    );
  }

  const io = req.app.get('io');
  if (io) {
    emitToWarehouse(io, 'order:approved', { orderId: order.id, orderNumber: order.orderNumber });
    emitToUser(io, order.userId, 'order:approved', { orderId: order.id, orderNumber: order.orderNumber });
  }

  res.json({ success: true, message: 'Order approved', data: { order } });
}));

router.post('/order/:id/reject', ...pharmacistAuth, [body('reason').notEmpty().withMessage('Rejection reason is required')], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  const { reason } = req.body;

  const order = await Order.findById(req.params.id);
  if (!order) throw new NotFoundError('Order not found');

  order.status = OrderStatus.REJECTED;
  order.reviewedBy = req.user!.userId;
  order.reviewedAt = new Date();
  order.pharmacistNotes = reason;
  await order.save();

  if (order.prescriptionIds?.length > 0) {
    await Prescription.updateMany(
      { _id: M.in(order.prescriptionIds) },
      { $set: { status: PrescriptionStatus.REJECTED, rejectionReason: reason } }
    );
  }

  const io = req.app.get('io');
  if (io) {
    emitToUser(io, order.userId, 'order:rejected', { orderId: order.id, orderNumber: order.orderNumber, reason });
  }

  res.json({ success: true, message: 'Order rejected', data: { order } });
}));

router.post('/order/:id/request-info', ...pharmacistAuth, [body('message').notEmpty()], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  const { message } = req.body;

  const order = await Order.findById(req.params.id);
  if (!order) throw new NotFoundError('Order not found');

  order.status = OrderStatus.PENDING_REVIEW;
  order.pharmacistNotes = message;
  await order.save();

  const io = req.app.get('io');
  if (io) {
    emitToUser(io, order.userId, 'order:info_requested', { orderId: order.id, orderNumber: order.orderNumber, message });
  }

  res.json({ success: true, message: 'Information requested from customer' });
}));

router.post('/order/:id/escalate', ...pharmacistAuth, [body('note').optional().isString()], asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new NotFoundError('Order not found');

  const note = req.body?.note || 'Escalated to senior pharmacist';
  order.status = OrderStatus.PENDING_REVIEW;
  order.pharmacistNotes = `ESCALATED: ${note}`;
  await order.save();

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

router.get('/stats', ...pharmacistAuth, asyncHandler(async (req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pendingCount = await Order.countDocuments({
    status: M.in([OrderStatus.PLACED, OrderStatus.PENDING_REVIEW]),
    prescriptionRequired: true,
  });

  const reviewedToday = await Order.countDocuments({
    reviewedBy: req.user!.userId,
    reviewedAt: M.gte(today),
  });

  const approvedToday = await Order.countDocuments({
    reviewedBy: req.user!.userId,
    reviewedAt: M.gte(today),
    status: OrderStatus.APPROVED,
  });

  res.json({
    success: true,
    data: { pendingCount, reviewedToday, approvedToday, rejectedToday: reviewedToday - approvedToday },
  });
}));

router.get('/queue/stats', ...pharmacistAuth, asyncHandler(async (req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const total = await Order.countDocuments({
    status: M.in([OrderStatus.PLACED, OrderStatus.PENDING_REVIEW]),
    prescriptionRequired: true,
  });
  const urgent = await Order.countDocuments({
    status: M.in([OrderStatus.PLACED, OrderStatus.PENDING_REVIEW]),
    prescriptionRequired: true,
    urgencyLevel: 'urgent',
  });
  const avgWait = await Order.find({
    status: M.in([OrderStatus.PLACED, OrderStatus.PENDING_REVIEW]),
    prescriptionRequired: true,
  })
    .select('createdAt')
    .lean();

  const avgWaitTime = avgWait.length
    ? Math.round(
        avgWait.reduce((sum: number, order: any) => {
          return sum + Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
        }, 0) / avgWait.length
      )
    : 0;

  const reviewedToday = await Order.countDocuments({
    reviewedBy: req.user!.userId,
    reviewedAt: M.gte(today),
  });
  const infoRequested = await Order.countDocuments({
    status: OrderStatus.PENDING_REVIEW,
    pharmacistNotes: rxInsensitive('info'),
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
