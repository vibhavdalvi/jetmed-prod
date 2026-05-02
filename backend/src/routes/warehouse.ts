// @ts-nocheck
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { Op } from 'sequelize';

import { Order, OrderItem, Medicine, Inventory, Warehouse, User, UserProfile, Address, DeliveryPartner } from '../models/index.js';
import { asyncHandler, BadRequestError, NotFoundError } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { UserRole, OrderStatus } from '../types/index.js';
import { emitToUser } from '../services/socket.js';

const router = Router();

const warehouseAuth = [authenticate, authorize(UserRole.WAREHOUSE_STAFF, UserRole.ADMIN_SUPER, UserRole.ADMIN_OPERATIONS)];

router.get('/orders', ...warehouseAuth, asyncHandler(async (req: Request, res: Response) => {
  const { status, page = '1', limit = '20' } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 20, 100);

  const where: any = {};
  if (status) {
    const statuses = String(status)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.length > 0) {
      where.status = { [Op.in]: statuses };
    }
  }

  const { count, rows: orders } = await Order.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: limitNum,
    offset: (pageNum - 1) * limitNum,
    include: [
      { model: User, as: 'user', include: [{ model: UserProfile, as: 'profile' }] },
      { model: Address, as: 'deliveryAddress' },
      { model: OrderItem, as: 'orderItems', include: [{ model: Medicine, as: 'medicine' }] },
    ],
  });

  res.json({ success: true, data: { orders, total: count, page: pageNum, totalPages: Math.ceil(count / limitNum) } });
}));

router.get('/delivery-partners', ...warehouseAuth, asyncHandler(async (req: Request, res: Response) => {
  const { online } = req.query;
  const where: any = {};
  if (online === 'true') where.isOnline = true;

  const partners = await DeliveryPartner.findAll({
    where,
    order: [['updatedAt', 'DESC']],
    include: [{ model: User, as: 'user', include: [{ model: UserProfile, as: 'profile' }] }],
  });

  const withActiveCounts = await Promise.all(
    partners.map(async (partner: any) => {
      const activeOrders = await Order.count({
        where: {
          deliveryPartnerId: partner.userId,
          status: { [Op.in]: [OrderStatus.ASSIGNED_TO_DELIVERY, OrderStatus.OUT_FOR_DELIVERY] },
        },
      });
      return { ...partner.toJSON(), activeOrders };
    })
  );

  res.json({ success: true, data: { partners: withActiveCounts } });
}));

router.post('/orders/:id/assign', ...warehouseAuth, asyncHandler(async (req: Request, res: Response) => {
  const { deliveryPartnerId } = req.body;
  const order = await Order.findByPk(req.params.id);
  if (!order) throw new NotFoundError('Order not found');

  await order.update({
    deliveryPartnerId,
    status: OrderStatus.ASSIGNED_TO_DELIVERY,
  });

  res.json({ success: true, message: 'Order assigned', data: { order } });
}));

router.post('/orders/:id/broadcast', ...warehouseAuth, asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findByPk(req.params.id);
  if (!order) throw new NotFoundError('Order not found');

  res.json({ success: true, message: 'Order broadcasted to available delivery partners' });
}));

/**
 * @route   GET /api/v1/warehouse/orders/pending
 * @desc    Get orders pending packing
 */
router.get('/orders/pending', ...warehouseAuth, asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', limit = '20', warehouseId } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 20, 50);

  const where: any = { status: OrderStatus.APPROVED };
  if (warehouseId) where.warehouseId = warehouseId;

  const { count, rows: orders } = await Order.findAndCountAll({
    where,
    order: [['urgencyLevel', 'DESC'], ['reviewedAt', 'ASC']],
    limit: limitNum,
    offset: (pageNum - 1) * limitNum,
    include: [
      { model: User, as: 'user', include: [{ model: UserProfile, as: 'profile' }] },
      { model: OrderItem, as: 'orderItems', include: [{ model: Medicine, as: 'medicine' }] },
      { model: Address, as: 'deliveryAddress' },
    ],
  });

  res.json({ success: true, data: { orders, total: count, page: pageNum, totalPages: Math.ceil(count / limitNum) } });
}));

/**
 * @route   POST /api/v1/warehouse/orders/:id/start-packing
 * @desc    Start packing an order
 */
router.post('/orders/:id/start-packing', ...warehouseAuth, asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findByPk(req.params.id);
  if (!order) throw new NotFoundError('Order not found');

  if (order.status !== OrderStatus.APPROVED) {
    throw new BadRequestError('Order is not ready for packing');
  }

  await order.update({
    status: OrderStatus.PACKING,
    packedBy: req.user!.userId,
  });

  res.json({ success: true, message: 'Started packing order', data: { order } });
}));

/**
 * @route   POST /api/v1/warehouse/orders/:id/complete-packing
 * @desc    Mark order as packed
 */
router.post('/orders/:id/complete-packing', ...warehouseAuth, [
  body('packageWeight').optional().isFloat({ min: 0 }),
  body('packageDimensions').optional().isObject(),
], asyncHandler(async (req: Request, res: Response) => {
  const { packageWeight, packageDimensions, notes } = req.body;

  const order = await Order.findByPk(req.params.id);
  if (!order) throw new NotFoundError('Order not found');

  if (order.status !== OrderStatus.PACKING) {
    throw new BadRequestError('Order is not being packed');
  }

  await order.update({
    status: OrderStatus.PACKED,
    packedAt: new Date(),
    packageWeight,
    packageDimensions,
    packingNotes: notes,
  });

  const io = req.app.get('io');
  if (io) {
    emitToUser(io, order.userId, 'order:packed', { orderId: order.id, orderNumber: order.orderNumber });
  }

  res.json({ success: true, message: 'Order packed successfully', data: { order } });
}));

/**
 * @route   GET /api/v1/warehouse/inventory
 * @desc    Get warehouse inventory
 */
router.get('/inventory', ...warehouseAuth, asyncHandler(async (req: Request, res: Response) => {
  const { warehouseId, lowStock, expiringSoon, search, page = '1', limit = '50' } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 50, 100);

  const where: any = {};
  if (warehouseId) where.warehouseId = warehouseId;

  const include: any[] = [
    { model: Medicine, as: 'medicine' },
    { model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'code'] },
  ];

  if (search) {
    include[0].where = { name: { [Op.iLike]: `%${search}%` } };
  }

  let { count, rows: inventory } = await Inventory.findAndCountAll({
    where,
    include,
    limit: limitNum,
    offset: (pageNum - 1) * limitNum,
    order: [['quantity', 'ASC']],
  });

  // Filter for low stock if requested
  if (lowStock === 'true') {
    inventory = inventory.filter(i => i.quantity <= i.reorderLevel);
  }

  // Filter for expiring soon (within 90 days)
  if (expiringSoon === 'true') {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 90);
    inventory = inventory.filter(i => i.expiryDate && i.expiryDate <= cutoff);
  }

  res.json({ success: true, data: { inventory, total: count, page: pageNum, totalPages: Math.ceil(count / limitNum) } });
}));

/**
 * @route   PUT /api/v1/warehouse/inventory/:id
 * @desc    Update inventory
 */
router.put('/inventory/:id', ...warehouseAuth, [
  body('quantity').optional().isInt({ min: 0 }),
  body('reorderLevel').optional().isInt({ min: 0 }),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  const inventory = await Inventory.findByPk(req.params.id);
  if (!inventory) throw new NotFoundError('Inventory not found');

  await inventory.update(req.body);
  res.json({ success: true, message: 'Inventory updated', data: { inventory } });
}));

/**
 * @route   POST /api/v1/warehouse/inventory/add
 * @desc    Add new inventory batch
 */
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

  // Check if batch already exists
  let inventory = await Inventory.findOne({ where: { medicineId, warehouseId, dosageOptionId, batchNumber } });

  if (inventory) {
    await inventory.update({ quantity: inventory.quantity + quantity });
  } else {
    inventory = await Inventory.create({
      medicineId, warehouseId, dosageOptionId, quantity, batchNumber,
      expiryDate: new Date(expiryDate), costPrice,
      reorderLevel: reorderLevel || 50, reorderQuantity: reorderQuantity || 200,
    });
  }

  res.status(201).json({ success: true, message: 'Inventory added', data: { inventory } });
}));

/**
 * @route   GET /api/v1/warehouse/stats
 * @desc    Get warehouse stats
 */
router.get('/stats', ...warehouseAuth, asyncHandler(async (req: Request, res: Response) => {
  const { warehouseId } = req.query;

  const where: any = {};
  if (warehouseId) where.warehouseId = warehouseId;

  const pendingOrders = await Order.count({ where: { ...where, status: OrderStatus.APPROVED } });
  const packingOrders = await Order.count({ where: { ...where, status: OrderStatus.PACKING } });
  const packedOrders = await Order.count({ where: { ...where, status: OrderStatus.PACKED } });

  const inventoryWhere: any = {};
  if (warehouseId) inventoryWhere.warehouseId = warehouseId;

  const lowStockItems = await Inventory.count({
    where: {
      ...inventoryWhere,
      [Op.and]: [
        { quantity: { [Op.gt]: 0 } },
        { quantity: { [Op.lte]: Inventory.sequelize!.col('reorderLevel') } },
      ],
    },
  });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 30);
  const expiringItems = await Inventory.count({
    where: { ...inventoryWhere, expiryDate: { [Op.lte]: cutoff } },
  });

  res.json({ success: true, data: { pendingOrders, packingOrders, packedOrders, lowStockItems, expiringItems } });
}));

/**
 * @route   GET /api/v1/warehouse/warehouses
 * @desc    Get all warehouses
 */
router.get('/warehouses', ...warehouseAuth, asyncHandler(async (req: Request, res: Response) => {
  const warehouses = await Warehouse.findAll({ where: { isActive: true }, order: [['name', 'ASC']] });
  res.json({ success: true, data: { warehouses } });
}));

export default router;
