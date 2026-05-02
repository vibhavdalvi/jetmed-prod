// @ts-nocheck
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';

import { Order, Medicine, Inventory, Warehouse, DeliveryPartner } from '../models/index.js';
import { asyncHandler, BadRequestError, NotFoundError } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { UserRole, OrderStatus } from '../types/index.js';
import { emitToUser } from '../services/socket.js';
import { M } from '../utils/mongoQuery.js';

const router = Router();

const warehouseAuth = [authenticate, authorize(UserRole.WAREHOUSE_STAFF, UserRole.ADMIN_SUPER, UserRole.ADMIN_OPERATIONS)];

const orderListPopulate = [
  { path: 'user', populate: { path: 'profile' } },
  { path: 'deliveryAddress' },
  { path: 'orderItems', populate: { path: 'medicine' } },
];

router.get('/orders', ...warehouseAuth, asyncHandler(async (req: Request, res: Response) => {
  const { status, page = '1', limit = '20' } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 20, 100);

  const filter: Record<string, unknown> = {};
  if (status) {
    const statuses = String(status)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.length > 0) {
      filter.status = M.in(statuses);
    }
  }

  const count = await Order.countDocuments(filter);
  const orders = await Order.find(filter)
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)
    .populate(orderListPopulate);

  res.json({ success: true, data: { orders, total: count, page: pageNum, totalPages: Math.ceil(count / limitNum) } });
}));

router.get('/delivery-partners', ...warehouseAuth, asyncHandler(async (req: Request, res: Response) => {
  const { online } = req.query;
  const filter: Record<string, unknown> = {};
  if (online === 'true') filter.isOnline = true;

  const partners = await DeliveryPartner.find(filter).sort({ updatedAt: -1 }).populate({
    path: 'user',
    populate: { path: 'profile' },
  });

  const withActiveCounts = await Promise.all(
    partners.map(async (partner: any) => {
      const activeOrders = await Order.countDocuments({
        deliveryPartnerId: partner.userId,
        status: M.in([OrderStatus.ASSIGNED_TO_DELIVERY, OrderStatus.OUT_FOR_DELIVERY]),
      });
      return { ...partner.toJSON(), activeOrders };
    })
  );

  res.json({ success: true, data: { partners: withActiveCounts } });
}));

router.post('/orders/:id/assign', ...warehouseAuth, asyncHandler(async (req: Request, res: Response) => {
  const { deliveryPartnerId } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw new NotFoundError('Order not found');

  order.deliveryPartnerId = deliveryPartnerId;
  order.status = OrderStatus.ASSIGNED_TO_DELIVERY;
  await order.save();

  res.json({ success: true, message: 'Order assigned', data: { order } });
}));

router.post('/orders/:id/broadcast', ...warehouseAuth, asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new NotFoundError('Order not found');

  res.json({ success: true, message: 'Order broadcasted to available delivery partners' });
}));

router.get('/orders/pending', ...warehouseAuth, asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', limit = '20', warehouseId } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 20, 50);

  const filter: Record<string, unknown> = { status: OrderStatus.APPROVED };
  if (warehouseId) filter.warehouseId = warehouseId;

  const count = await Order.countDocuments(filter);
  const orders = await Order.find(filter)
    .sort({ urgencyLevel: -1, reviewedAt: 1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)
    .populate(orderListPopulate);

  res.json({ success: true, data: { orders, total: count, page: pageNum, totalPages: Math.ceil(count / limitNum) } });
}));

router.post('/orders/:id/start-packing', ...warehouseAuth, asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new NotFoundError('Order not found');

  if (order.status !== OrderStatus.APPROVED) {
    throw new BadRequestError('Order is not ready for packing');
  }

  order.status = OrderStatus.PACKING;
  order.packedBy = req.user!.userId;
  await order.save();

  res.json({ success: true, message: 'Started packing order', data: { order } });
}));

router.post('/orders/:id/complete-packing', ...warehouseAuth, [
  body('packageWeight').optional().isFloat({ min: 0 }),
  body('packageDimensions').optional().isObject(),
], asyncHandler(async (req: Request, res: Response) => {
  const { packageWeight, packageDimensions, notes } = req.body;

  const order = await Order.findById(req.params.id);
  if (!order) throw new NotFoundError('Order not found');

  if (order.status !== OrderStatus.PACKING) {
    throw new BadRequestError('Order is not being packed');
  }

  order.status = OrderStatus.PACKED;
  order.packedAt = new Date();
  order.packageWeight = packageWeight;
  order.packageDimensions = packageDimensions;
  order.packingNotes = notes;
  await order.save();

  const io = req.app.get('io');
  if (io) {
    emitToUser(io, order.userId, 'order:packed', { orderId: order.id, orderNumber: order.orderNumber });
  }

  res.json({ success: true, message: 'Order packed successfully', data: { order } });
}));

router.get('/inventory', ...warehouseAuth, asyncHandler(async (req: Request, res: Response) => {
  const { warehouseId, lowStock, expiringSoon, search, page = '1', limit = '50' } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 50, 100);

  const filter: Record<string, unknown> = {};
  if (warehouseId) filter.warehouseId = warehouseId;

  if (search) {
    const meds = await Medicine.find({ name: M.iLike(String(search)) }).select('_id').lean();
    const ids = meds.map((m) => m._id);
    filter.medicineId = ids.length ? M.in(ids) : { $in: [] };
  }

  const count = await Inventory.countDocuments(filter);
  let inventory = await Inventory.find(filter)
    .sort({ quantity: 1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)
    .populate([
      { path: 'medicine' },
      { path: 'warehouse', select: 'name code' },
    ]);

  if (lowStock === 'true') {
    inventory = inventory.filter((i: any) => i.quantity <= i.reorderLevel);
  }

  if (expiringSoon === 'true') {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 90);
    inventory = inventory.filter((i: any) => i.expiryDate && i.expiryDate <= cutoff);
  }

  res.json({ success: true, data: { inventory, total: count, page: pageNum, totalPages: Math.ceil(count / limitNum) } });
}));

router.put('/inventory/:id', ...warehouseAuth, [
  body('quantity').optional().isInt({ min: 0 }),
  body('reorderLevel').optional().isInt({ min: 0 }),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  const inventory = await Inventory.findById(req.params.id);
  if (!inventory) throw new NotFoundError('Inventory not found');

  Object.assign(inventory, req.body);
  await inventory.save();
  res.json({ success: true, message: 'Inventory updated', data: { inventory } });
}));

router.post('/inventory/add', ...warehouseAuth, [
  body('medicineId').isUUID(),
  body('warehouseId').isUUID(),
  body('dosageOptionId').notEmpty(),
  body('quantity').isInt({ min: 1 }),
  body('batchNumber').notEmpty(),
  body('expiryDate').isISO8601(),
  body('costPrice').isFloat({ min: 0 }),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  const { medicineId, warehouseId, dosageOptionId, quantity, batchNumber, expiryDate, costPrice, reorderLevel, reorderQuantity } = req.body;

  let inventory = await Inventory.findOne({ medicineId, warehouseId, dosageOptionId, batchNumber });

  if (inventory) {
    inventory.quantity += quantity;
    await inventory.save();
  } else {
    inventory = await Inventory.create({
      medicineId,
      warehouseId,
      dosageOptionId,
      quantity,
      batchNumber,
      expiryDate: new Date(expiryDate),
      costPrice,
      reorderLevel: reorderLevel || 50,
      reorderQuantity: reorderQuantity || 200,
    });
  }

  res.status(201).json({ success: true, message: 'Inventory added', data: { inventory } });
}));

router.get('/stats', ...warehouseAuth, asyncHandler(async (req: Request, res: Response) => {
  const { warehouseId } = req.query;

  const orderExtra: Record<string, unknown> = {};
  if (warehouseId) orderExtra.warehouseId = warehouseId;

  const pendingOrders = await Order.countDocuments({ ...orderExtra, status: OrderStatus.APPROVED });
  const packingOrders = await Order.countDocuments({ ...orderExtra, status: OrderStatus.PACKING });
  const packedOrders = await Order.countDocuments({ ...orderExtra, status: OrderStatus.PACKED });

  const inventoryMatch: Record<string, unknown> = {};
  if (warehouseId) inventoryMatch.warehouseId = warehouseId;

  const lowStockItems = await Inventory.countDocuments({
    ...inventoryMatch,
    quantity: M.gt(0),
    $expr: { $lte: ['$quantity', '$reorderLevel'] },
  });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 30);
  const expiringItems = await Inventory.countDocuments({
    ...inventoryMatch,
    expiryDate: M.lte(cutoff),
  });

  res.json({ success: true, data: { pendingOrders, packingOrders, packedOrders, lowStockItems, expiringItems } });
}));

router.get('/warehouses', ...warehouseAuth, asyncHandler(async (req: Request, res: Response) => {
  const warehouses = await Warehouse.find({ isActive: true }).sort({ name: 1 });
  res.json({ success: true, data: { warehouses } });
}));

export default router;
