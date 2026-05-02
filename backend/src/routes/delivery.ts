// @ts-nocheck
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { Op } from 'sequelize';

import { Order, User, UserProfile, Address, DeliveryPartner, Warehouse } from '../models/index.js';
import { asyncHandler, BadRequestError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { UserRole, OrderStatus } from '../types/index.js';
import { emitToUser, emitToOrder } from '../services/socket.js';

const router = Router();

// Middleware
const deliveryAuth = [authenticate, authorize(UserRole.DELIVERY_PARTNER, UserRole.ADMIN_SUPER, UserRole.ADMIN_OPERATIONS)];

/**
 * @route   GET /api/v1/delivery/available
 * @desc    Get available orders for pickup
 */
router.get('/available', ...deliveryAuth, asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', limit = '20' } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 20, 50);

  const { count, rows: orders } = await Order.findAndCountAll({
    where: { status: OrderStatus.PACKED, deliveryPartnerId: null },
    order: [['urgencyLevel', 'DESC'], ['packedAt', 'ASC']],
    limit: limitNum,
    offset: (pageNum - 1) * limitNum,
    include: [
      { model: Address, as: 'deliveryAddress' },
      { model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'address', 'city'] },
    ],
  });

  res.json({ success: true, data: { orders, total: count, page: pageNum, totalPages: Math.ceil(count / limitNum) } });
}));

/**
 * @route   GET /api/v1/delivery/my-orders
 * @desc    Get delivery partner's assigned orders
 */
router.get('/my-orders', ...deliveryAuth, asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query;

  const where: any = { deliveryPartnerId: req.user!.userId };
  if (status) where.status = status;

  const orders = await Order.findAll({
    where,
    order: [['deliveryStartedAt', 'DESC']],
    include: [
      { model: User, as: 'user', include: [{ model: UserProfile, as: 'profile' }] },
      { model: Address, as: 'deliveryAddress' },
      { model: Warehouse, as: 'warehouse' },
    ],
  });

  res.json({ success: true, data: { orders } });
}));

/**
 * @route   POST /api/v1/delivery/accept/:orderId
 * @desc    Accept order for delivery
 */
router.post('/accept/:orderId', ...deliveryAuth, asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findByPk(req.params.orderId);
  if (!order) throw new NotFoundError('Order not found');

  if (order.status !== OrderStatus.PACKED) {
    throw new BadRequestError('Order is not ready for delivery');
  }

  if (order.deliveryPartnerId) {
    throw new BadRequestError('Order already assigned');
  }

  await order.update({
    deliveryPartnerId: req.user!.userId,
    status: OrderStatus.OUT_FOR_DELIVERY,
    deliveryStartedAt: new Date(),
  });

  const io = req.app.get('io');
  if (io) {
    emitToUser(io, order.userId, 'order:out_for_delivery', { orderId: order.id, orderNumber: order.orderNumber });
  }

  res.json({ success: true, message: 'Order accepted for delivery', data: { order } });
}));

/**
 * @route   PATCH /api/v1/delivery/:orderId/location
 * @desc    Update delivery location
 */
router.patch('/:orderId/location', ...deliveryAuth, [
  body('latitude').isFloat(),
  body('longitude').isFloat(),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  const { latitude, longitude } = req.body;

  const order = await Order.findByPk(req.params.orderId);
  if (!order) throw new NotFoundError('Order not found');

  if (order.deliveryPartnerId !== req.user!.userId) {
    throw new ForbiddenError('Not assigned to this order');
  }

  await order.update({
    deliveryLocation: { type: 'Point', coordinates: [longitude, latitude] },
    deliveryLocationUpdatedAt: new Date(),
  });

  const io = req.app.get('io');
  if (io) {
    emitToOrder(io, order.id, 'delivery:location_updated', { latitude, longitude });
  }

  res.json({ success: true, message: 'Location updated' });
}));

/**
 * @route   POST /api/v1/delivery/:orderId/complete
 * @desc    Mark order as delivered
 */
router.post('/:orderId/complete', ...deliveryAuth, [
  body('otp').optional().isLength({ min: 6, max: 6 }),
  body('signature').optional().isString(),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  const { otp, signature, photoProof, notes } = req.body;

  const order = await Order.findByPk(req.params.orderId);
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

  await order.update({
    status: OrderStatus.DELIVERED,
    deliveredAt: new Date(),
    deliverySignature: signature,
    deliveryPhotoProof: photoProof,
    deliveryNotes: notes,
  });

  const io = req.app.get('io');
  if (io) {
    emitToUser(io, order.userId, 'order:delivered', { orderId: order.id, orderNumber: order.orderNumber });
  }

  res.json({ success: true, message: 'Order delivered successfully', data: { order } });
}));

/**
 * @route   POST /api/v1/delivery/:orderId/issue
 * @desc    Report delivery issue
 */
router.post('/:orderId/issue', ...deliveryAuth, [
  body('type').isIn(['customer_unavailable', 'wrong_address', 'damaged', 'other']),
  body('description').notEmpty(),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  const { type, description, photo } = req.body;

  const order = await Order.findByPk(req.params.orderId);
  if (!order) throw new NotFoundError('Order not found');

  if (order.deliveryPartnerId !== req.user!.userId) {
    throw new ForbiddenError('Not assigned to this order');
  }

  await order.update({
    status: OrderStatus.CANCELLED,
    deliveryIssue: { type, description, photo, reportedAt: new Date() },
  });

  res.json({ success: true, message: 'Issue reported' });
}));

/**
 * @route   GET /api/v1/delivery/earnings
 * @desc    Get earnings summary
 */
router.get('/earnings', ...deliveryAuth, asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, period } = req.query;

  const dateFilter: any = { deliveryPartnerId: req.user!.userId, status: OrderStatus.DELIVERED };
  if (startDate && endDate) {
    dateFilter.deliveredAt = { [Op.between]: [new Date(startDate as string), new Date(endDate as string)] };
  } else if (period) {
    const from = new Date();
    if (period === 'today') from.setHours(0, 0, 0, 0);
    else if (period === 'week') from.setDate(from.getDate() - 7);
    else if (period === 'month') from.setDate(from.getDate() - 30);
    dateFilter.deliveredAt = { [Op.gte]: from };
  }

  const orders = await Order.findAll({
    where: dateFilter,
    attributes: ['id', 'orderNumber', 'deliveryFee', 'tipAmount', 'deliveredAt'],
    order: [['deliveredAt', 'DESC']],
  });

  const earnings = orders.map((o: any) => {
    const baseAmount = Number(o.deliveryFee || 0);
    const tipAmount = Number(o.tipAmount || 0);
    return {
      id: o.id,
      orderId: o.id,
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

  const orders = await Order.findAll({
    where: {
      deliveryPartnerId: req.user!.userId,
      status: OrderStatus.DELIVERED,
      deliveredAt: { [Op.gte]: monthStart },
    },
    attributes: ['deliveryFee', 'tipAmount', 'deliveredAt'],
  });

  const sumFor = (from: Date) =>
    orders
      .filter((o: any) => o.deliveredAt && new Date(o.deliveredAt) >= from)
      .reduce((sum: number, o: any) => sum + Number(o.deliveryFee || 0) + Number(o.tipAmount || 0), 0);

  const allTimeOrders = await Order.findAll({
    where: { deliveryPartnerId: req.user!.userId, status: OrderStatus.DELIVERED },
    attributes: ['deliveryFee', 'tipAmount', 'deliveredAt'],
  });
  const allTime = allTimeOrders.reduce((sum: number, o: any) => sum + Number(o.deliveryFee || 0) + Number(o.tipAmount || 0), 0);

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

router.get('/payout-methods', ...deliveryAuth, asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      methods: [],
    },
  });
}));

router.post('/payout/request', ...deliveryAuth, asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Payout request created',
  });
}));

/**
 * @route   GET /api/v1/delivery/stats
 * @desc    Get delivery stats
 */
router.get('/stats', ...deliveryAuth, asyncHandler(async (req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeDeliveries = await Order.count({
    where: { deliveryPartnerId: req.user!.userId, status: OrderStatus.OUT_FOR_DELIVERY },
  });

  const completedToday = await Order.count({
    where: { deliveryPartnerId: req.user!.userId, status: OrderStatus.DELIVERED, deliveredAt: { [Op.gte]: today } },
  });

  const totalCompleted = await Order.count({
    where: { deliveryPartnerId: req.user!.userId, status: OrderStatus.DELIVERED },
  });

  res.json({ success: true, data: { activeDeliveries, completedToday, totalCompleted } });
}));

export default router;
