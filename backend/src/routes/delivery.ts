// @ts-nocheck
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';

import { Order } from '../models/index.js';
import { asyncHandler, BadRequestError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { UserRole, OrderStatus } from '../types/index.js';
import { emitToUser, emitToOrder } from '../services/socket.js';
import { M } from '../utils/mongoQuery.js';

const router = Router();

const deliveryAuth = [authenticate, authorize(UserRole.DELIVERY_PARTNER, UserRole.ADMIN_SUPER, UserRole.ADMIN_OPERATIONS)];

router.get('/available', ...deliveryAuth, asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', limit = '20' } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 20, 50);

  const filter = { status: OrderStatus.PACKED, deliveryPartnerId: null };
  const count = await Order.countDocuments(filter);
  const orders = await Order.find(filter)
    .sort({ urgencyLevel: -1, packedAt: 1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)
    .populate([
      { path: 'deliveryAddress' },
      { path: 'warehouse', select: 'name address city' },
    ]);

  res.json({ success: true, data: { orders, total: count, page: pageNum, totalPages: Math.ceil(count / limitNum) } });
}));

router.get('/my-orders', ...deliveryAuth, asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query;

  const filter: Record<string, unknown> = { deliveryPartnerId: req.user!.userId };
  if (status) filter.status = status;

  const orders = await Order.find(filter)
    .sort({ deliveryStartedAt: -1 })
    .populate([
      { path: 'user', populate: { path: 'profile' } },
      { path: 'deliveryAddress' },
      { path: 'warehouse' },
    ]);

  res.json({ success: true, data: { orders } });
}));

router.post('/accept/:orderId', ...deliveryAuth, asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) throw new NotFoundError('Order not found');

  if (order.status !== OrderStatus.PACKED) {
    throw new BadRequestError('Order is not ready for delivery');
  }

  if (order.deliveryPartnerId) {
    throw new BadRequestError('Order already assigned');
  }

  order.deliveryPartnerId = req.user!.userId;
  order.status = OrderStatus.OUT_FOR_DELIVERY;
  order.deliveryStartedAt = new Date();
  await order.save();

  const io = req.app.get('io');
  if (io) {
    emitToUser(io, order.userId, 'order:out_for_delivery', { orderId: order.id, orderNumber: order.orderNumber });
  }

  res.json({ success: true, message: 'Order accepted for delivery', data: { order } });
}));

router.patch('/:orderId/location', ...deliveryAuth, [
  body('latitude').isFloat(),
  body('longitude').isFloat(),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  const { latitude, longitude } = req.body;

  const order = await Order.findById(req.params.orderId);
  if (!order) throw new NotFoundError('Order not found');

  if (order.deliveryPartnerId !== req.user!.userId) {
    throw new ForbiddenError('Not assigned to this order');
  }

  order.deliveryLocation = { type: 'Point', coordinates: [longitude, latitude] };
  order.deliveryLocationUpdatedAt = new Date();
  await order.save();

  const io = req.app.get('io');
  if (io) {
    emitToOrder(io, order.id, 'delivery:location_updated', { latitude, longitude });
  }

  res.json({ success: true, message: 'Location updated' });
}));

router.post('/:orderId/complete', ...deliveryAuth, [
  body('otp').optional().isLength({ min: 6, max: 6 }),
  body('signature').optional().isString(),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  const { otp, signature, photoProof, notes } = req.body;

  const order = await Order.findById(req.params.orderId);
  if (!order) throw new NotFoundError('Order not found');

  if (order.deliveryPartnerId !== req.user!.userId) {
    throw new ForbiddenError('Not assigned to this order');
  }

  if (order.deliveryOTP && !otp) {
    throw new BadRequestError('OTP is required for this delivery');
  }

  if (order.deliveryOTP && order.deliveryOTP !== otp) {
    throw new BadRequestError('Invalid OTP');
  }

  order.status = OrderStatus.DELIVERED;
  order.deliveredAt = new Date();
  order.deliverySignature = signature;
  order.deliveryPhotoProof = photoProof;
  order.deliveryNotes = notes;
  await order.save();

  const io = req.app.get('io');
  if (io) {
    emitToUser(io, order.userId, 'order:delivered', { orderId: order.id, orderNumber: order.orderNumber });
  }

  res.json({ success: true, message: 'Order delivered successfully', data: { order } });
}));

router.post('/:orderId/issue', ...deliveryAuth, [
  body('type').isIn(['customer_unavailable', 'wrong_address', 'damaged', 'other']),
  body('description').notEmpty(),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  const { type, description, photo } = req.body;

  const order = await Order.findById(req.params.orderId);
  if (!order) throw new NotFoundError('Order not found');

  if (order.deliveryPartnerId !== req.user!.userId) {
    throw new ForbiddenError('Not assigned to this order');
  }

  order.status = OrderStatus.CANCELLED;
  order.deliveryIssue = { type, description, photo, reportedAt: new Date() };
  await order.save();

  res.json({ success: true, message: 'Issue reported' });
}));

router.get('/earnings', ...deliveryAuth, asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, period } = req.query;

  const dateFilter: Record<string, unknown> = {
    deliveryPartnerId: req.user!.userId,
    status: OrderStatus.DELIVERED,
  };
  if (startDate && endDate) {
    dateFilter.deliveredAt = M.between(new Date(startDate as string), new Date(endDate as string));
  } else if (period) {
    const from = new Date();
    if (period === 'today') from.setHours(0, 0, 0, 0);
    else if (period === 'week') from.setDate(from.getDate() - 7);
    else if (period === 'month') from.setDate(from.getDate() - 30);
    dateFilter.deliveredAt = M.gte(from);
  }

  const orders = await Order.find(dateFilter)
    .select('orderNumber deliveryFee tipAmount deliveredAt')
    .sort({ deliveredAt: -1 })
    .lean();

  const earnings = orders.map((o: any) => {
    const baseAmount = Number(o.deliveryFee || 0);
    const tipAmount = Number(o.tipAmount || 0);
    return {
      id: o._id,
      orderId: o._id,
      orderNumber: o.orderNumber,
      baseAmount,
      distanceBonus: 0,
      timeBonus: 0,
      surgeBonus: 0,
      tipAmount,
      totalAmount: baseAmount + tipAmount,
      isPaid: true,
      paidAt: o.deliveredAt,
      createdAt: o.deliveredAt,
    };
  });

  const totalDeliveries = earnings.length;
  const totalEarnings = earnings.reduce((sum, e) => sum + e.totalAmount, 0);
  const totalTips = earnings.reduce((sum, e) => sum + e.tipAmount, 0);

  res.json({
    success: true,
    data: {
      totalDeliveries,
      totalEarnings,
      totalTips,
      deliveryFees: totalEarnings - totalTips,
      earnings,
    },
  });
}));

router.get('/earnings/stats', ...deliveryAuth, asyncHandler(async (req: Request, res: Response) => {
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date();
  monthStart.setDate(monthStart.getDate() - 30);

  const orders = await Order.find({
    deliveryPartnerId: req.user!.userId,
    status: OrderStatus.DELIVERED,
    deliveredAt: M.gte(monthStart),
  })
    .select('deliveryFee tipAmount deliveredAt')
    .lean();

  const sumFor = (from: Date) =>
    orders
      .filter((o: any) => o.deliveredAt && new Date(o.deliveredAt) >= from)
      .reduce((sum: number, o: any) => sum + Number(o.deliveryFee || 0) + Number(o.tipAmount || 0), 0);

  const allTimeOrders = await Order.find({
    deliveryPartnerId: req.user!.userId,
    status: OrderStatus.DELIVERED,
  })
    .select('deliveryFee tipAmount deliveredAt')
    .lean();

  const allTime = allTimeOrders.reduce(
    (sum: number, o: any) => sum + Number(o.deliveryFee || 0) + Number(o.tipAmount || 0),
    0
  );

  const stats = {
    today: sumFor(today),
    thisWeek: sumFor(weekStart),
    thisMonth: sumFor(monthStart),
    allTime,
    pendingPayout: sumFor(weekStart),
    lastPayout: 0,
    lastPayoutDate: now.toISOString(),
    totalDeliveries: allTimeOrders.length,
    averagePerDelivery: allTimeOrders.length ? allTime / allTimeOrders.length : 0,
    averageRating: 5,
  };

  res.json({ success: true, data: { stats } });
}));

router.get('/payout-methods', ...deliveryAuth, asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      methods: [],
    },
  });
}));

router.post('/payout/request', ...deliveryAuth, asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Payout request created',
  });
}));

router.get('/stats', ...deliveryAuth, asyncHandler(async (req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeDeliveries = await Order.countDocuments({
    deliveryPartnerId: req.user!.userId,
    status: OrderStatus.OUT_FOR_DELIVERY,
  });

  const completedToday = await Order.countDocuments({
    deliveryPartnerId: req.user!.userId,
    status: OrderStatus.DELIVERED,
    deliveredAt: M.gte(today),
  });

  const totalCompleted = await Order.countDocuments({
    deliveryPartnerId: req.user!.userId,
    status: OrderStatus.DELIVERED,
  });

  res.json({ success: true, data: { activeDeliveries, completedToday, totalCompleted } });
}));

export default router;
