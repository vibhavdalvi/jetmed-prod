// @ts-nocheck
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';

import { User, UserProfile, Order, Medicine, Inventory, Warehouse, AppSetting } from '../models/index.js';
import { asyncHandler, BadRequestError, NotFoundError } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { UserRole, OrderStatus } from '../types/index.js';
import { ActivityLog } from '../mongo/activityLog.model.js';
import { M } from '../utils/mongoQuery.js';

const router = Router();

const adminAuth = [
  authenticate,
  authorize(
    UserRole.ADMIN_SUPER,
    UserRole.ADMIN_OPERATIONS,
    UserRole.ADMIN_CONTENT,
    UserRole.ADMIN_FINANCE,
    UserRole.ADMIN_SUPPORT
  ),
];
const superAdminAuth = [authenticate, authorize(UserRole.ADMIN_SUPER)];
const defaultAppSettings: any = {
  general: {
    siteName: 'JetMed',
    supportEmail: 'support@jetmed.com',
    supportPhone: '+1 (555) 123-4567',
    timezone: 'America/New_York',
    currency: 'USD',
  },
  delivery: {
    standardFee: 5.99,
    expressFee: 9.99,
    emergencyFee: 14.99,
    freeDeliveryThreshold: 50,
    maxDeliveryRadius: 25,
    estimatedStandardTime: 120,
    estimatedExpressTime: 60,
  },
  orders: {
    minOrderAmount: 10,
    maxItemsPerOrder: 20,
    orderCancellationWindow: 30,
    autoApproveOTC: true,
    requireSignature: false,
    requireOTPForRx: true,
  },
  notifications: {
    emailEnabled: true,
    smsEnabled: true,
    pushEnabled: true,
    orderUpdates: true,
    promotions: false,
    lowStockAlerts: true,
    lowStockThreshold: 20,
  },
  payment: {
    stripeEnabled: true,
    codEnabled: true,
    walletEnabled: true,
    minWalletTopup: 10,
    maxWalletBalance: 500,
  },
  security: {
    sessionTimeout: 60,
    maxLoginAttempts: 5,
    requireEmailVerification: true,
    require2FA: false,
    passwordMinLength: 8,
  },
};

async function sumOrderAmount(match: Record<string, unknown>): Promise<number> {
  const agg = await Order.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
  ]);
  return agg[0]?.total || 0;
}

router.get('/dashboard', ...adminAuth, asyncHandler(async (_req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const totalOrders = await Order.countDocuments({});
  const ordersToday = await Order.countDocuments({ createdAt: M.gte(today) });
  const ordersThisMonth = await Order.countDocuments({ createdAt: M.gte(thisMonth) });
  const pendingOrders = await Order.countDocuments({
    status: M.in([OrderStatus.PLACED, OrderStatus.PENDING_REVIEW]),
  });

  const revenueToday = await sumOrderAmount({
    status: OrderStatus.DELIVERED,
    deliveredAt: M.gte(today),
  });
  const revenueThisMonth = await sumOrderAmount({
    status: OrderStatus.DELIVERED,
    deliveredAt: M.gte(thisMonth),
  });

  const totalUsers = await User.countDocuments({ role: UserRole.CUSTOMER });
  const newUsersToday = await User.countDocuments({
    role: UserRole.CUSTOMER,
    createdAt: M.gte(today),
  });

  const lowStockCount = await Inventory.countDocuments({ quantity: M.lte(50) });

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

router.get('/activity-log', ...adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 200);
  const action = req.query.action ? String(req.query.action) : undefined;
  const filter = action ? { action } : {};
  const activities = await ActivityLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();

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
  const setting = await AppSetting.findOne({ key: 'admin_settings' });
  const settings = setting?.value || defaultAppSettings;
  res.json({ success: true, data: { settings } });
}));

router.put('/settings', ...adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const incoming = req.body || {};
  const existing = await AppSetting.findOne({ key: 'admin_settings' });
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
    existing.value = mergedSettings;
    await existing.save();
  } else {
    await AppSetting.create({ key: 'admin_settings', value: mergedSettings });
  }

  res.json({ success: true, message: 'Settings saved', data: { settings: mergedSettings } });
}));

router.get('/users', ...adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const { role, status, search, page = '1', limit = '20' } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 20, 100);

  const filter: Record<string, unknown> = {};
  if (role) filter.role = role;
  if (status === 'active') filter.isActive = true;
  if (status === 'inactive') filter.isActive = false;
  if (status === 'verified') filter.isVerified = true;
  if (status === 'unverified') filter.isVerified = false;
  if (search) {
    filter.$or = [{ email: M.iLike(String(search)) }, { phone: M.iLike(String(search)) }];
  }

  const count = await User.countDocuments(filter);
  const users = await User.find(filter)
    .select('-password')
    .populate({ path: 'profile' })
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum);

  res.json({ success: true, data: { users, total: count, page: pageNum, totalPages: Math.ceil(count / limitNum) } });
}));

router.patch('/users/:id/status', ...adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new NotFoundError('User not found');

  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') {
    throw new BadRequestError('isActive must be a boolean');
  }

  user.isActive = isActive;
  await user.save();
  res.json({ success: true, message: 'User status updated', data: { user } });
}));

router.get('/users/export', ...adminAuth, asyncHandler(async (_req: Request, res: Response) => {
  const users = await User.find({})
    .select('email phone role isActive isVerified createdAt updatedAt')
    .populate({ path: 'profile', select: 'firstName lastName' })
    .sort({ createdAt: -1 });

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

  const existing = await User.findOne({ email });
  if (existing) throw new BadRequestError('Email already registered');

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await User.create({
    email,
    password: hashedPassword,
    role,
    phone,
    isVerified: true,
    isActive: true,
  });

  await UserProfile.create({ userId: user.id, firstName, lastName });

  res.status(201).json({ success: true, message: 'User created', data: { userId: user.id } });
}));

router.put('/users/:id', ...superAdminAuth, asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new NotFoundError('User not found');

  const { role, isVerified, isActive } = req.body;
  if (role !== undefined) user.role = role;
  if (typeof isVerified === 'boolean') user.isVerified = isVerified;
  if (typeof isActive === 'boolean') user.isActive = isActive;
  await user.save();

  res.json({ success: true, message: 'User updated' });
}));

router.delete('/users/:id', ...superAdminAuth, asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new NotFoundError('User not found');

  user.isActive = false;
  await user.save();
  res.json({ success: true, message: 'User suspended' });
}));

router.get('/medicines', ...adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const { search, category, status, page = '1', limit = '20' } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 20, 100);

  const filter: Record<string, unknown> = {};
  if (category) filter.category = category;
  if (status === 'active') filter.isActive = true;
  if (status === 'inactive') filter.isActive = false;
  if (search) {
    filter.$or = [{ name: M.iLike(String(search)) }, { genericName: M.iLike(String(search)) }];
  }

  const count = await Medicine.countDocuments(filter);
  const medicines = await Medicine.find(filter)
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)
    .populate({ path: 'inventoryItems', select: '_id' });

  res.json({ success: true, data: { medicines, total: count, page: pageNum, totalPages: Math.ceil(count / limitNum) } });
}));

router.patch('/medicines/:id', ...adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const medicine = await Medicine.findById(req.params.id);
  if (!medicine) throw new NotFoundError('Medicine not found');

  Object.assign(medicine, req.body);
  await medicine.save();
  res.json({ success: true, message: 'Medicine updated', data: { medicine } });
}));

router.get('/medicines/export', ...adminAuth, asyncHandler(async (_req: Request, res: Response) => {
  const medicines = await Medicine.find({})
    .select('name genericName category type prescriptionRequirement manufacturer isActive createdAt')
    .sort({ createdAt: -1 });

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

  const deliveredOrders = await Order.find({
    status: OrderStatus.DELIVERED,
    deliveredAt: M.gte(startDate),
  })
    .select('totalAmount status createdAt deliveredAt items')
    .sort({ deliveredAt: 1 })
    .lean();

  const allRangeOrders = await Order.find({ createdAt: M.gte(startDate) })
    .select('status items createdAt')
    .lean();

  const totalRevenue = deliveredOrders.reduce((sum: number, order: any) => sum + Number(order.totalAmount || 0), 0);
  const totalOrders = allRangeOrders.length;
  const userTotal = await User.countDocuments({ role: UserRole.CUSTOMER });
  const newUsers = await User.countDocuments({
    role: UserRole.CUSTOMER,
    createdAt: M.gte(startDate),
  });

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

  const orders = await Order.find({ createdAt: M.gte(startDate) })
    .select('orderNumber status totalAmount createdAt deliveredAt')
    .sort({ createdAt: -1 })
    .lean();

  const lines = [
    'id,orderNumber,status,totalAmount,createdAt,deliveredAt',
    ...orders.map((order: any) => {
      const values = [
        order._id,
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

router.get('/orders', ...adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const { status, startDate, endDate, page = '1', limit = '20' } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = Math.min(parseInt(limit as string) || 20, 100);

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (startDate && endDate) {
    filter.createdAt = M.between(new Date(startDate as string), new Date(endDate as string));
  }

  const count = await Order.countDocuments(filter);
  const orders = await Order.find(filter)
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)
    .populate([{ path: 'user', populate: { path: 'profile' } }]);

  res.json({ success: true, data: { orders, total: count, page: pageNum, totalPages: Math.ceil(count / limitNum) } });
}));

router.get('/analytics/revenue', ...adminAuth, asyncHandler(async (req: Request, res: Response) => {
  const { period = '30' } = req.query;
  const days = parseInt(period as string) || 30;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const orders = await Order.find({
    status: OrderStatus.DELIVERED,
    deliveredAt: M.gte(startDate),
  })
    .select('totalAmount deliveredAt')
    .sort({ deliveredAt: 1 })
    .lean();

  const revenueByDay: Record<string, number> = {};
  orders.forEach((order: any) => {
    const date = order.deliveredAt ? new Date(order.deliveredAt).toISOString().split('T')[0] : '';
    if (!date) return;
    revenueByDay[date] = (revenueByDay[date] || 0) + Number(order.totalAmount || 0);
  });

  const totalRevenue = orders.reduce((sum, o: any) => sum + Number(o.totalAmount || 0), 0);
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

router.get('/analytics/orders', ...adminAuth, asyncHandler(async (_req: Request, res: Response) => {
  const statusCounts = await Order.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $project: { status: '$_id', count: 1, _id: 0 } },
  ]);

  res.json({ success: true, data: { statusCounts } });
}));

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

router.put('/warehouses/:id', ...superAdminAuth, asyncHandler(async (req: Request, res: Response) => {
  const warehouse = await Warehouse.findById(req.params.id);
  if (!warehouse) throw new NotFoundError('Warehouse not found');

  Object.assign(warehouse, req.body);
  await warehouse.save();
  res.json({ success: true, message: 'Warehouse updated', data: { warehouse } });
}));

export default router;
