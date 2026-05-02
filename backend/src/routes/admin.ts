// @ts-nocheck
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { Op } from 'sequelize';
import bcrypt from 'bcryptjs';

import { User, UserProfile, Order, Medicine, Inventory, Warehouse, Payment, AppSetting } from '../models/index.js';
import { asyncHandler, BadRequestError, NotFoundError } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { UserRole, OrderStatus, PaymentStatus } from '../types/index.js';
import { ActivityLog } from '../mongo/activityLog.model.js';

const router = Router();

const adminAuth = [authenticate, authorize(UserRole.ADMIN_SUPER, UserRole.ADMIN_OPERATIONS, UserRole.ADMIN_CONTENT, UserRole.ADMIN_FINANCE, UserRole.ADMIN_SUPPORT)];
const superAdminAuth = [authenticate, authorize(UserRole.ADMIN_SUPER)];
const defaultAppSettings: any = {
  general: { siteName: 'JetMed', supportEmail: 'support@jetmed.com', supportPhone: '+1 (555) 123-4567', timezone: 'America/New_York', currency: 'USD' },
  delivery: { standardFee: 5.99, expressFee: 9.99, emergencyFee: 14.99, freeDeliveryThreshold: 50, maxDeliveryRadius: 25, estimatedStandardTime: 120, estimatedExpressTime: 60 },
  orders: { minOrderAmount: 10, maxItemsPerOrder: 20, orderCancellationWindow: 30, autoApproveOTC: true, requireSignature: false, requireOTPForRx: true },
  notifications: { emailEnabled: true, smsEnabled: true, pushEnabled: true, orderUpdates: true, promotions: false, lowStockAlerts: true, lowStockThreshold: 20 },
  payment: { stripeEnabled: true, codEnabled: true, walletEnabled: true, minWalletTopup: 10, maxWalletBalance: 500 },
  security: { sessionTimeout: 60, maxLoginAttempts: 5, requireEmailVerification: true, require2FA: false, passwordMinLength: 8 },
};

/**
 * @route   GET /api/v1/admin/dashboard
 * @desc    Get admin dashboard stats
 */
router.get('/dashboard', ...adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Order stats
  const totalOrders = await Order.count();
  const ordersToday = await Order.count({ where: { createdAt: { [Op.gte]: today } } });
  const ordersThisMonth = await Order.count({ where: { createdAt: { [Op.gte]: thisMonth } } });
  const pendingOrders = await Order.count({ where: { status: { [Op.in]: [OrderStatus.PLACED, OrderStatus.PENDING_REVIEW] } } });

  // Revenue stats
  const revenueToday = await Order.sum('totalAmount', { where: { status: OrderStatus.DELIVERED, deliveredAt: { [Op.gte]: today } } }) || 0;
  const revenueThisMonth = await Order.sum('totalAmount', { where: { status: OrderStatus.DELIVERED, deliveredAt: { [Op.gte]: thisMonth } } }) || 0;

  // User stats
  const totalUsers = await User.count({ where: { role: UserRole.CUSTOMER } });
  const newUsersToday = await User.count({ where: { role: UserRole.CUSTOMER, createdAt: { [Op.gte]: today } } });

  // Inventory alerts
  const lowStockCount = await Inventory.count({
    where: { quantity: { [Op.lte]: 50 } },
  });

  res.json({
    success: true,
    data: {
      orders: { total: totalOrders, today: ordersToday, thisMonth: ordersThisMonth, pending: pendingOrders },
      revenue: { today: revenueToday, thisMonth: revenueThisMonth },
      users: { total: totalUsers, newToday: newUsersToday },
      alerts: { lowStock: lowStockCount },
    },
  });
}));

/**
 * @route   GET /api/v1/admin/activity-log
 * @desc    Recent audit events (stored in MongoDB)
 */
router.get('/activity-log', ...adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 200);
  const action = req.query.action ? String(req.query.action) : undefined;
  const filter = action ? { action } : {};
  const activities = await ActivityLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  res.json({
    success: true,
    data: {
      activities: activities.map((a) => ({
        id: String(a._id),
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        userId: a.userId,
        role: a.role,
        metadata: a.metadata,
        ip: a.ip,
        createdAt: a.createdAt,
      })),
    },
  });
}));

router.get('/settings', ...adminAuth, asyncHandler(async (_req: Request, res: Response) => {
  const setting = await AppSetting.findOne({ where: { key: 'admin_settings' } });
  const settings = setting?.value || defaultAppSettings;
  res.json({ success: true, data: { settings } });
}));

router.put('/settings', ...adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const incoming = req.body || {};
  const existing = await AppSetting.findOne({ where: { key: 'admin_settings' } });
  const currentSettings = (existing?.value || defaultAppSettings) as any;
  const mergedSettings = {
    ...currentSettings,
    ...incoming,
    general: { ...currentSettings.general, ...(incoming.general || {}) },
    delivery: { ...currentSettings.delivery, ...(incoming.delivery || {}) },
    orders: { ...currentSettings.orders, ...(incoming.orders || {}) },
    notifications: { ...currentSettings.notifications, ...(incoming.notifications || {}) },
    payment: { ...currentSettings.payment, ...(incoming.payment || {}) },
    security: { ...currentSettings.security, ...(incoming.security || {}) },
  };

  if (existing) {
    await existing.update({ value: mergedSettings });
  } else {
    await AppSetting.create({ key: 'admin_settings', value: mergedSettings });
  }

  res.json({ success: true, message: 'Settings saved', data: { settings: mergedSettings } });
}));

/**
 * @route   GET /api/v1/admin/users
 * @desc    Get all users with filters
 */
router.get('/users', ...adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const { role, status, search, page = '1', limit = '20' } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 20, 100);

  const where: any = {};
  if (role) where.role = role;
  if (status === 'active') where.isActive = true;
  if (status === 'inactive') where.isActive = false;
  if (status === 'verified') where.isVerified = true;
  if (status === 'unverified') where.isVerified = false;
  if (search) {
    where[Op.or] = [
      { email: { [Op.iLike]: `%${search}%` } },
      { phone: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const { count, rows: users } = await User.findAndCountAll({
    where,
    attributes: { exclude: ['password'] },
    include: [{ model: UserProfile, as: 'profile' }],
    order: [['createdAt', 'DESC']],
    limit: limitNum,
    offset: (pageNum - 1) * limitNum,
  });

  res.json({ success: true, data: { users, total: count, page: pageNum, totalPages: Math.ceil(count / limitNum) } });
}));

router.patch('/users/:id/status', ...adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findByPk(req.params.id);
  if (!user) throw new NotFoundError('User not found');

  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') {
    throw new BadRequestError('isActive must be a boolean');
  }

  await user.update({ isActive });
  res.json({ success: true, message: 'User status updated', data: { user } });
}));

router.get('/users/export', ...adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const users = await User.findAll({
    attributes: ['id', 'email', 'phone', 'role', 'isActive', 'isVerified', 'createdAt', 'updatedAt'],
    include: [{ model: UserProfile, as: 'profile', attributes: ['firstName', 'lastName'] }],
    order: [['createdAt', 'DESC']],
  });

  const lines = [
    'id,firstName,lastName,email,phone,role,isActive,isVerified,createdAt',
    ...users.map((user: any) => {
      const profile = user.profile || {};
      const values = [
        user.id,
        profile.firstName || '',
        profile.lastName || '',
        user.email || '',
        user.phone || '',
        user.role || '',
        String(!!user.isActive),
        String(!!user.isVerified),
        user.createdAt ? new Date(user.createdAt).toISOString() : '',
      ];
      return values.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    }),
  ];

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="users-${new Date().toISOString().split('T')[0]}.csv"`);
  res.send(lines.join('\n'));
}));

/**
 * @route   POST /api/v1/admin/users
 * @desc    Create new user (staff)
 */
router.post('/users', ...superAdminAuth, [
  body('email').isEmail(),
  body('password').isLength({ min: 8 }),
  body('role').isIn(Object.values(UserRole)),
  body('firstName').notEmpty(),
  body('lastName').notEmpty(),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  const { email, password, role, phone, firstName, lastName } = req.body;

  const existing = await User.findOne({ where: { email } });
  if (existing) throw new BadRequestError('Email already registered');

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await User.create({
    email,
    password: hashedPassword,
    role,
    phone,
    isEmailVerified: true,
  });

  await UserProfile.create({ userId: user.id, firstName, lastName });

  res.status(201).json({ success: true, message: 'User created', data: { userId: user.id } });
}));

/**
 * @route   PUT /api/v1/admin/users/:id
 * @desc    Update user
 */
router.put('/users/:id', ...superAdminAuth, asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findByPk(req.params.id);
  if (!user) throw new NotFoundError('User not found');

  const { role, status, isEmailVerified, isPhoneVerified } = req.body;
  await user.update({ role, status, isEmailVerified, isPhoneVerified });

  res.json({ success: true, message: 'User updated' });
}));

/**
 * @route   DELETE /api/v1/admin/users/:id
 * @desc    Deactivate user
 */
router.delete('/users/:id', ...superAdminAuth, asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findByPk(req.params.id);
  if (!user) throw new NotFoundError('User not found');

  await user.update({ status: 'suspended' });
  res.json({ success: true, message: 'User suspended' });
}));

router.get('/medicines', ...adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const { search, category, status, page = '1', limit = '20' } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 20, 100);

  const where: any = {};
  if (category) where.category = category;
  if (status === 'active') where.isActive = true;
  if (status === 'inactive') where.isActive = false;
  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { genericName: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const { count, rows: medicines } = await Medicine.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: limitNum,
    offset: (pageNum - 1) * limitNum,
    include: [{ model: Inventory, as: 'inventoryItems', attributes: ['id'] }],
  });

  res.json({ success: true, data: { medicines, total: count, page: pageNum, totalPages: Math.ceil(count / limitNum) } });
}));

router.patch('/medicines/:id', ...adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const medicine = await Medicine.findByPk(req.params.id);
  if (!medicine) throw new NotFoundError('Medicine not found');

  await medicine.update(req.body);
  res.json({ success: true, message: 'Medicine updated', data: { medicine } });
}));

router.get('/medicines/export', ...adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const medicines = await Medicine.findAll({
    attributes: ['id', 'name', 'genericName', 'category', 'type', 'prescriptionRequirement', 'manufacturer', 'isActive', 'createdAt'],
    order: [['createdAt', 'DESC']],
  });

  const lines = [
    'id,name,genericName,category,type,prescriptionRequirement,manufacturer,isActive,createdAt',
    ...medicines.map((medicine: any) => {
      const values = [
        medicine.id,
        medicine.name || '',
        medicine.genericName || '',
        medicine.category || '',
        medicine.type || '',
        medicine.prescriptionRequirement || '',
        medicine.manufacturer || '',
        String(!!medicine.isActive),
        medicine.createdAt ? new Date(medicine.createdAt).toISOString() : '',
      ];
      return values.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    }),
  ];

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="medicines-${new Date().toISOString().split('T')[0]}.csv"`);
  res.send(lines.join('\n'));
}));

router.get('/analytics', ...adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const range = String(req.query.range || 'month');
  const startDate = new Date();
  if (range === 'today') startDate.setHours(0, 0, 0, 0);
  else if (range === 'week') startDate.setDate(startDate.getDate() - 7);
  else if (range === 'quarter') startDate.setDate(startDate.getDate() - 90);
  else if (range === 'year') startDate.setDate(startDate.getDate() - 365);
  else startDate.setDate(startDate.getDate() - 30);

  const deliveredOrders = await Order.findAll({
    where: { status: OrderStatus.DELIVERED, deliveredAt: { [Op.gte]: startDate } },
    attributes: ['id', 'totalAmount', 'status', 'createdAt', 'deliveredAt', 'items'],
    order: [['deliveredAt', 'ASC']],
  });

  const allRangeOrders = await Order.findAll({
    where: { createdAt: { [Op.gte]: startDate } },
    attributes: ['id', 'status', 'items', 'createdAt'],
  });

  const totalRevenue = deliveredOrders.reduce((sum: number, order: any) => sum + Number(order.totalAmount || 0), 0);
  const totalOrders = allRangeOrders.length;
  const userTotal = await User.count({ where: { role: UserRole.CUSTOMER } });
  const newUsers = await User.count({ where: { role: UserRole.CUSTOMER, createdAt: { [Op.gte]: startDate } } });

  const ordersByStatusMap: Record<string, number> = {};
  allRangeOrders.forEach((o: any) => {
    ordersByStatusMap[o.status] = (ordersByStatusMap[o.status] || 0) + 1;
  });
  const ordersByStatus = Object.entries(ordersByStatusMap).map(([status, count]) => ({
    status: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    count,
    percentage: totalOrders ? (count / totalOrders) * 100 : 0,
  }));

  const topMedicineMap: Record<string, { sold: number; revenue: number }> = {};
  deliveredOrders.forEach((order: any) => {
    const items = Array.isArray(order.items) ? order.items : [];
    items.forEach((item: any) => {
      const key = item.medicineName || item.name || item.medicineId || 'Unknown Medicine';
      const qty = Number(item.quantity || 0);
      const lineRevenue = Number(item.totalPrice || item.unitPrice * qty || 0);
      if (!topMedicineMap[key]) topMedicineMap[key] = { sold: 0, revenue: 0 };
      topMedicineMap[key].sold += qty;
      topMedicineMap[key].revenue += lineRevenue;
    });
  });
  const topMedicines = Object.entries(topMedicineMap)
    .map(([name, stats], index) => ({ id: `${index + 1}`, name, sold: stats.sold, revenue: stats.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const revenueByDateMap: Record<string, number> = {};
  const ordersByDateMap: Record<string, number> = {};
  deliveredOrders.forEach((order: any) => {
    const key = order.deliveredAt ? new Date(order.deliveredAt).toISOString().split('T')[0] : '';
    if (!key) return;
    revenueByDateMap[key] = (revenueByDateMap[key] || 0) + Number(order.totalAmount || 0);
  });
  allRangeOrders.forEach((order: any) => {
    const key = order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : '';
    if (!key) return;
    ordersByDateMap[key] = (ordersByDateMap[key] || 0) + 1;
  });
  const revenueData = Object.entries(revenueByDateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount }));
  const ordersData = Object.entries(ordersByDateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  res.json({
    success: true,
    data: {
      revenue: { total: totalRevenue, change: 0, data: revenueData },
      orders: { total: totalOrders, change: 0, data: ordersData },
      users: { total: userTotal, change: 0, newThisPeriod: newUsers },
      topMedicines,
      ordersByStatus,
      revenueByCategory: [],
      deliveryMetrics: { avgDeliveryTime: 0, onTimeRate: 0, completionRate: 0 },
    },
  });
}));

router.get('/analytics/export', ...adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const range = String(req.query.range || 'month');
  const startDate = new Date();
  if (range === 'today') startDate.setHours(0, 0, 0, 0);
  else if (range === 'week') startDate.setDate(startDate.getDate() - 7);
  else if (range === 'quarter') startDate.setDate(startDate.getDate() - 90);
  else if (range === 'year') startDate.setDate(startDate.getDate() - 365);
  else startDate.setDate(startDate.getDate() - 30);

  const orders = await Order.findAll({
    where: { createdAt: { [Op.gte]: startDate } },
    attributes: ['id', 'orderNumber', 'status', 'totalAmount', 'createdAt', 'deliveredAt'],
    order: [['createdAt', 'DESC']],
  });

  const lines = [
    'id,orderNumber,status,totalAmount,createdAt,deliveredAt',
    ...orders.map((order: any) => {
      const values = [
        order.id,
        order.orderNumber,
        order.status,
        Number(order.totalAmount || 0).toFixed(2),
        order.createdAt ? new Date(order.createdAt).toISOString() : '',
        order.deliveredAt ? new Date(order.deliveredAt).toISOString() : '',
      ];
      return values.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    }),
  ];

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="analytics-${range}-${new Date().toISOString().split('T')[0]}.csv"`);
  res.send(lines.join('\n'));
}));

/**
 * @route   GET /api/v1/admin/orders
 * @desc    Get all orders
 */
router.get('/orders', ...adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const { status, startDate, endDate, page = '1', limit = '20' } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 20, 100);

  const where: any = {};
  if (status) where.status = status;
  if (startDate && endDate) {
    where.createdAt = { [Op.between]: [new Date(startDate as string), new Date(endDate as string)] };
  }

  const { count, rows: orders } = await Order.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: limitNum,
    offset: (pageNum - 1) * limitNum,
    include: [{ model: User, as: 'user', include: [{ model: UserProfile, as: 'profile' }] }],
  });

  res.json({ success: true, data: { orders, total: count, page: pageNum, totalPages: Math.ceil(count / limitNum) } });
}));

/**
 * @route   GET /api/v1/admin/analytics/revenue
 * @desc    Get revenue analytics
 */
router.get('/analytics/revenue', ...adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const { period = '30' } = req.query;
  const days = parseInt(period as string) || 30;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const orders = await Order.findAll({
    where: { status: OrderStatus.DELIVERED, deliveredAt: { [Op.gte]: startDate } },
    attributes: ['totalAmount', 'deliveredAt'],
    order: [['deliveredAt', 'ASC']],
  });

  // Group by day
  const revenueByDay: Record<string, number> = {};
  orders.forEach(order => {
    const date = order.deliveredAt!.toISOString().split('T')[0];
    revenueByDay[date] = (revenueByDay[date] || 0) + order.totalAmount;
  });

  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

  res.json({
    success: true,
    data: {
      totalRevenue,
      orderCount: orders.length,
      avgOrderValue,
      revenueByDay: Object.entries(revenueByDay).map(([date, amount]) => ({ date, amount })),
    },
  });
}));

/**
 * @route   GET /api/v1/admin/analytics/orders
 * @desc    Get order analytics
 */
router.get('/analytics/orders', ...adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const statusCounts = await Order.findAll({
    attributes: ['status', [Order.sequelize!.fn('COUNT', '*'), 'count']],
    group: ['status'],
    raw: true,
  });

  res.json({ success: true, data: { statusCounts } });
}));

/**
 * @route   POST /api/v1/admin/warehouses
 * @desc    Create warehouse
 */
router.post('/warehouses', ...superAdminAuth, [
  body('name').notEmpty(),
  body('code').notEmpty(),
  body('address').notEmpty(),
  body('city').notEmpty(),
  body('state').notEmpty(),
  body('zipCode').notEmpty(),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new BadRequestError('Validation failed', errors.array());

  const warehouse = await Warehouse.create(req.body);
  res.status(201).json({ success: true, message: 'Warehouse created', data: { warehouse } });
}));

/**
 * @route   PUT /api/v1/admin/warehouses/:id
 * @desc    Update warehouse
 */
router.put('/warehouses/:id', ...superAdminAuth, asyncHandler(async (req: Request, res: Response) => {
  const warehouse = await Warehouse.findByPk(req.params.id);
  if (!warehouse) throw new NotFoundError('Warehouse not found');

  await warehouse.update(req.body);
  res.json({ success: true, message: 'Warehouse updated', data: { warehouse } });
}));

export default router;
