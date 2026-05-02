// @ts-nocheck
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Stripe from 'stripe';

import { Order, OrderItem, Address, Medicine, Warehouse, Inventory, Payment, Prescription, Wallet, WalletTransaction } from '../models/index.js';
import { asyncHandler, BadRequestError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { OrderStatus, DeliveryType, UrgencyLevel, UserRole, PaymentStatus, PaymentMethod } from '../types/index.js';
import { emitToUser, emitToOrder } from '../services/socket.js';
import config from '../config/index.js';
import { getFileUrl } from '../middleware/upload.js';
import { recordActivity, requestAuditContext } from '../services/activityLog.js';
import { M } from '../utils/mongoQuery.js';

const router = Router();
const stripe = new Stripe(config.stripe.secretKey, { apiVersion: '2023-10-16' });

const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

const orderListPopulate = [
  { path: 'user', populate: { path: 'profile' } },
  { path: 'deliveryAddress' },
  { path: 'warehouse', select: 'name city' },
];

const orderDetailPopulate = [
  { path: 'user', populate: { path: 'profile' } },
  { path: 'deliveryAddress' },
  { path: 'warehouse' },
  { path: 'orderItems', populate: { path: 'medicine' } },
  { path: 'payments' },
  { path: 'reviewer', populate: { path: 'profile' } },
  { path: 'deliveryPartner', populate: { path: 'profile' } },
];

function orderLookupFilter(id: string) {
  return isValidUUID(id) ? { _id: id } : { orderNumber: id };
}

const processOrderRefund = async (order: any, reason: string): Promise<void> => {
  const payment = await Payment.findOne({
    orderId: order.id,
    status: M.in([PaymentStatus.COMPLETED, PaymentStatus.PARTIALLY_REFUNDED]),
  }).sort({ createdAt: -1 });
  if (!payment) return;

  const refundableAmount = Number(payment.amount) - Number(payment.refundedAmount || 0);
  if (refundableAmount <= 0) return;

  if (payment.method === PaymentMethod.CARD && payment.stripeChargeId) {
    await stripe.refunds.create({
      charge: payment.stripeChargeId,
      amount: Math.round(refundableAmount * 100),
    });
  } else if (payment.method === PaymentMethod.WALLET) {
    const wallet = await Wallet.findOne({ userId: payment.userId });
    if (wallet) {
      const newBalance = Number(wallet.balance) + refundableAmount;
      wallet.balance = newBalance;
      await wallet.save();
      await WalletTransaction.create({
        walletId: wallet.id,
        type: 'credit',
        amount: refundableAmount,
        description: `Refund for order ${order.orderNumber}`,
        referenceType: 'refund',
        referenceId: payment.id,
        balanceAfter: newBalance,
      });
    }
  }

  payment.status = PaymentStatus.REFUNDED;
  payment.refundedAmount = Number(payment.refundedAmount || 0) + refundableAmount;
  payment.refundReason = reason;
  payment.refundedAt = new Date();
  await payment.save();
};

router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { page = '1', limit = '10', status, startDate, endDate, search } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 10, 50);
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = {};

    const adminRoles = [UserRole.ADMIN_SUPER, UserRole.ADMIN_OPERATIONS, UserRole.ADMIN_SUPPORT];
    if (!adminRoles.includes(req.user!.role as UserRole)) {
      filter.userId = req.user!.userId;
    }

    if (status) {
      filter.status = status;
    }

    if (startDate && endDate) {
      filter.createdAt = M.between(new Date(startDate as string), new Date(endDate as string));
    }

    if (search) {
      filter.orderNumber = M.iLike(String(search));
    }

    const count = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate(orderListPopulate);

    res.json({
      success: true,
      data: {
        orders,
        total: count,
        page: pageNum,
        totalPages: Math.ceil(count / limitNum),
      },
    });
  })
);

router.get(
  '/stats/summary',
  authenticate,
  authorize(UserRole.ADMIN_SUPER, UserRole.ADMIN_OPERATIONS, UserRole.ADMIN_FINANCE),
  asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    const dateFilter: Record<string, unknown> = {};
    if (startDate && endDate) {
      dateFilter.createdAt = M.between(new Date(startDate as string), new Date(endDate as string));
    }

    const totalOrders = await Order.countDocuments(dateFilter);
    const completedOrders = await Order.countDocuments({ ...dateFilter, status: OrderStatus.DELIVERED });
    const cancelledOrders = await Order.countDocuments({ ...dateFilter, status: OrderStatus.CANCELLED });
    const pendingOrders = await Order.countDocuments({
      ...dateFilter,
      status: M.in([OrderStatus.PLACED, OrderStatus.PENDING_REVIEW, OrderStatus.APPROVED, OrderStatus.PACKING]),
    });

    const revAgg = await Order.aggregate([
      { $match: { ...dateFilter, status: OrderStatus.DELIVERED } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    const revenue = revAgg[0]?.total || 0;

    res.json({
      success: true,
      data: {
        totalOrders,
        completedOrders,
        cancelledOrders,
        pendingOrders,
        revenue,
        completionRate: totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(2) : 0,
      },
    });
  })
);

router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const order = await Order.findOne(orderLookupFilter(id)).populate(orderDetailPopulate);

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    const adminRoles = [
      UserRole.ADMIN_SUPER,
      UserRole.ADMIN_OPERATIONS,
      UserRole.ADMIN_SUPPORT,
      UserRole.PHARMACIST,
      UserRole.SENIOR_PHARMACIST,
      UserRole.DELIVERY_PARTNER,
      UserRole.WAREHOUSE_STAFF,
    ];
    if (!adminRoles.includes(req.user!.role as UserRole) && order.userId !== req.user!.userId) {
      throw new ForbiddenError('Access denied');
    }

    const prescriptionIds = Array.isArray(order.prescriptionIds) ? order.prescriptionIds : [];
    const prescriptions = prescriptionIds.length
      ? await Prescription.find({ _id: M.in(prescriptionIds) })
          .select('filePath status createdAt')
          .sort({ createdAt: -1 })
      : [];

    const prescriptionsForClient = prescriptions.map((prescription: any) => ({
      ...prescription.toJSON(),
      imageUrl: prescription.filePath ? getFileUrl(prescription.filePath) : null,
    }));

    res.json({ success: true, data: { order, prescriptions: prescriptionsForClient } });
  })
);

router.get('/:id/invoice', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const order = await Order.findOne(orderLookupFilter(id));
  if (!order) throw new NotFoundError('Order not found');

  const adminRoles = [UserRole.ADMIN_SUPER, UserRole.ADMIN_OPERATIONS, UserRole.ADMIN_SUPPORT];
  if (!adminRoles.includes(req.user!.role as UserRole) && order.userId !== req.user!.userId) {
    throw new ForbiddenError('Access denied');
  }

  const invoice = [
    `JetMed Invoice`,
    `Order: ${order.orderNumber}`,
    `Date: ${new Date(order.createdAt).toISOString()}`,
    `Status: ${order.status}`,
    `Subtotal: ${Number(order.subtotal).toFixed(2)}`,
    `Delivery Fee: ${Number(order.deliveryFee).toFixed(2)}`,
    `Platform Fee: ${Number(order.platformFee).toFixed(2)}`,
    `Tax: ${Number(order.taxAmount).toFixed(2)}`,
    `Discount: ${Number(order.discountAmount).toFixed(2)}`,
    `Tip: ${Number(order.tipAmount).toFixed(2)}`,
    `Total: ${Number(order.totalAmount).toFixed(2)}`,
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${order.orderNumber}-invoice.txt"`);
  res.send(invoice);
}));

router.post(
  '/',
  authenticate,
  authorize(UserRole.CUSTOMER),
  [
    body('addressId')
      .isString()
      .trim()
      .custom((value) => isValidUUID(value))
      .withMessage('Valid address ID is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.medicineId')
      .isString()
      .trim()
      .custom((value) => isValidUUID(value))
      .withMessage('Valid medicine ID is required'),
    body('items.*.dosageOptionId').notEmpty().withMessage('Dosage option is required'),
    body('items.*.quantity').isInt({ min: 1, max: 10 }).withMessage('Quantity must be 1-10'),
    body('deliveryType').isIn(Object.values(DeliveryType)).withMessage('Invalid delivery type'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', errors.array());
    }

    const {
      addressId,
      items,
      deliveryType,
      urgencyLevel = UrgencyLevel.ROUTINE,
      symptomsDescription,
      guidedResponses,
      prescriptionIds,
      promoCodeId,
      tipAmount = 0,
    } = req.body;

    const address = await Address.findOne({ _id: addressId, userId: req.user!.userId });
    if (!address) {
      throw new BadRequestError('Invalid address');
    }

    const warehouse = await Warehouse.findOne({ isActive: true });
    if (!warehouse) {
      throw new BadRequestError('No warehouse available for delivery');
    }

    let subtotal = 0;
    let prescriptionRequired = false;
    const orderItems: any[] = [];

    for (const item of items) {
      const medicine = await Medicine.findById(item.medicineId);
      if (!medicine || !medicine.isActive) {
        throw new BadRequestError(`Medicine not found: ${item.medicineId}`);
      }

      const dosageOption = medicine.dosageOptions.find((d: any) => d.id === item.dosageOptionId);
      if (!dosageOption) {
        throw new BadRequestError(`Invalid dosage option for ${medicine.name}`);
      }

      const inventory = await Inventory.findOne({
        medicineId: medicine.id,
        dosageOptionId: item.dosageOptionId,
        warehouseId: warehouse.id,
      });

      if (!inventory || inventory.quantity - inventory.reservedQuantity < item.quantity) {
        throw new BadRequestError(`Insufficient stock for ${medicine.name}`);
      }

      const itemTotal = dosageOption.price * item.quantity;
      subtotal += itemTotal;

      if (medicine.prescriptionRequirement === 'prescription_required') {
        prescriptionRequired = true;
      }

      orderItems.push({
        medicineId: medicine.id,
        dosageOptionId: item.dosageOptionId,
        quantity: item.quantity,
        unitPrice: dosageOption.price,
        totalPrice: itemTotal,
        prescriptionRequired: medicine.prescriptionRequirement === 'prescription_required',
      });

      inventory.reservedQuantity = inventory.reservedQuantity + item.quantity;
      await inventory.save();
    }

    const deliveryFees: Record<string, number> = {
      [DeliveryType.EXPRESS]: 9.99,
      [DeliveryType.STANDARD]: 5.99,
      [DeliveryType.SCHEDULED]: 3.99,
      [DeliveryType.EMERGENCY]: 14.99,
    };

    const deliveryFee = subtotal >= 50 ? 0 : deliveryFees[deliveryType] || 5.99;
    const platformFee = 1.99;
    const taxAmount = subtotal * 0.08;
    const discountAmount = 0;
    const totalAmount = subtotal + deliveryFee + platformFee + taxAmount - discountAmount + tipAmount;

    const order = await Order.create({
      orderNumber: Order.generateOrderNumber(),
      userId: req.user!.userId,
      warehouseId: warehouse.id,
      addressId,
      status: prescriptionRequired ? OrderStatus.PLACED : OrderStatus.APPROVED,
      items: orderItems,
      subtotal,
      deliveryFee,
      platformFee,
      taxAmount,
      discountAmount,
      tipAmount,
      totalAmount,
      deliveryType,
      urgencyLevel,
      prescriptionRequired,
      prescriptionIds: prescriptionIds || [],
      symptomsDescription,
      guidedResponses,
      promoCodeId,
      deliveryOTP: prescriptionRequired ? Order.generateOTP() : undefined,
    });

    for (const item of orderItems) {
      await OrderItem.create({
        orderId: order.id,
        ...item,
      });
    }

    const io = req.app.get('io');
    if (prescriptionRequired && io) {
      io.to('role:pharmacist').to('role:senior_pharmacist').emit('pharmacist:new_order', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        urgencyLevel,
        prescriptionRequired: true,
      });
    }

    void recordActivity({
      action: 'order.created',
      entityType: 'order',
      entityId: order.id,
      userId: req.user!.userId,
      role: req.user!.role,
      metadata: {
        orderNumber: order.orderNumber,
        totalAmount: Number(order.totalAmount),
        prescriptionRequired,
        deliveryType,
      },
      ...requestAuditContext(req),
    });

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: { order },
    });
  })
);

router.patch(
  '/:id/status',
  authenticate,
  authorize(
    UserRole.PHARMACIST,
    UserRole.SENIOR_PHARMACIST,
    UserRole.WAREHOUSE_STAFF,
    UserRole.DELIVERY_PARTNER,
    UserRole.ADMIN_SUPER,
    UserRole.ADMIN_OPERATIONS
  ),
  body('status').isIn(Object.values(OrderStatus)).withMessage('Invalid status'),
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', errors.array());
    }

    const { id } = req.params;
    const { status, notes, rejectionReason } = req.body;

    const order = await Order.findOne(orderLookupFilter(id));

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    const previousStatus = order.status;
    const io = req.app.get('io');

    switch (status) {
      case OrderStatus.APPROVED:
        order.reviewedBy = req.user!.userId;
        order.reviewedAt = new Date();
        order.pharmacistNotes = notes;
        if (io) {
          io.to('role:warehouse_staff').emit('order:approved', { orderId: order.id, orderNumber: order.orderNumber });
        }
        break;

      case OrderStatus.REJECTED:
        order.reviewedBy = req.user!.userId;
        order.reviewedAt = new Date();
        order.pharmacistNotes = rejectionReason;
        await processOrderRefund(order, rejectionReason || 'Order rejected by pharmacist');
        break;

      case OrderStatus.PACKING:
        order.packedBy = req.user!.userId;
        break;

      case OrderStatus.PACKED:
        order.packedAt = new Date();
        break;

      case OrderStatus.OUT_FOR_DELIVERY:
        order.deliveryPartnerId = req.user!.userId;
        order.deliveryStartedAt = new Date();
        break;

      case OrderStatus.DELIVERED:
        order.deliveredAt = new Date();
        for (const item of order.items) {
          const inv = await Inventory.findOne({
            medicineId: item.medicineId,
            dosageOptionId: item.dosageOptionId,
            warehouseId: order.warehouseId,
          });
          if (inv) {
            inv.quantity = inv.quantity - item.quantity;
            inv.reservedQuantity = inv.reservedQuantity - item.quantity;
            await inv.save();
          }
        }
        break;

      case OrderStatus.CANCELLED:
        order.cancelledBy = req.user!.userId;
        order.cancelledAt = new Date();
        order.cancellationReason = notes;
        for (const item of order.items) {
          const inv = await Inventory.findOne({
            medicineId: item.medicineId,
            dosageOptionId: item.dosageOptionId,
            warehouseId: order.warehouseId,
          });
          if (inv) {
            inv.reservedQuantity = Math.max(0, inv.reservedQuantity - item.quantity);
            await inv.save();
          }
        }
        break;
    }

    order.status = status;
    await order.save();

    if (io) {
      emitToUser(io, order.userId, 'order:status_updated', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status,
      });
      emitToOrder(io, order.id, 'order:updated', { status });
    }

    void recordActivity({
      action: 'order.status_changed',
      entityType: 'order',
      entityId: order.id,
      userId: req.user!.userId,
      role: req.user!.role,
      metadata: {
        orderNumber: order.orderNumber,
        previousStatus,
        newStatus: status,
      },
      ...requestAuditContext(req),
    });

    res.json({
      success: true,
      message: `Order status updated to ${status}`,
      data: { order },
    });
  })
);

router.post(
  '/:id/cancel',
  authenticate,
  body('reason').notEmpty().withMessage('Cancellation reason is required'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await Order.findOne(orderLookupFilter(id));

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (order.userId !== req.user!.userId) {
      throw new ForbiddenError('Access denied');
    }

    const cancellableStatuses = [OrderStatus.PLACED, OrderStatus.PENDING_REVIEW, OrderStatus.APPROVED];
    if (!cancellableStatuses.includes(order.status)) {
      throw new BadRequestError('Order cannot be cancelled at this stage');
    }

    order.status = OrderStatus.CANCELLED;
    order.cancellationReason = reason;
    order.cancelledBy = req.user!.userId;
    order.cancelledAt = new Date();
    await order.save();

    for (const item of order.items) {
      const inv = await Inventory.findOne({
        medicineId: item.medicineId,
        dosageOptionId: item.dosageOptionId,
        warehouseId: order.warehouseId,
      });
      if (inv) {
        inv.reservedQuantity = Math.max(0, inv.reservedQuantity - item.quantity);
        await inv.save();
      }
    }

    await processOrderRefund(order, reason || 'Order cancelled by customer');

    void recordActivity({
      action: 'order.cancelled_by_customer',
      entityType: 'order',
      entityId: order.id,
      userId: req.user!.userId,
      role: req.user!.role,
      metadata: { orderNumber: order.orderNumber, reason },
      ...requestAuditContext(req),
    });

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: { order },
    });
  })
);

router.post(
  '/:id/verify-otp',
  authenticate,
  authorize(UserRole.DELIVERY_PARTNER),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('Invalid OTP'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { otp } = req.body;

    const order = await Order.findOne(orderLookupFilter(id));

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (order.deliveryPartnerId !== req.user!.userId) {
      throw new ForbiddenError('Not assigned to this order');
    }

    if (order.deliveryOTP !== otp) {
      throw new BadRequestError('Invalid OTP');
    }

    res.json({
      success: true,
      message: 'OTP verified successfully',
    });
  })
);

export default router;
