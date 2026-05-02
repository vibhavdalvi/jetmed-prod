import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { body, query, validationResult } from 'express-validator';
import Stripe from 'stripe';

import { Order, OrderItem, User, UserProfile, Address, Medicine, Warehouse, Inventory, Payment, Prescription, Wallet, WalletTransaction } from '../models/index.js';
import { asyncHandler, BadRequestError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { authenticate, authorize, isOwnerOrAdmin } from '../middleware/auth.js';
import { OrderStatus, DeliveryType, UrgencyLevel, UserRole, PaymentStatus, PaymentMethod } from '../types/index.js';
// FIX: Only import functions that actually exist in socket.ts
import { emitToUser, emitToOrder } from '../services/socket.js';
import config from '../config/index.js';
import { getFileUrl } from '../middleware/upload.js';
import { recordActivity, requestAuditContext } from '../services/activityLog.js';

const router = Router();
const stripe = new Stripe(config.stripe.secretKey, { apiVersion: '2023-10-16' });

// Helper function to check if string is a valid UUID
const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

const processOrderRefund = async (order: any, reason: string): Promise<void> => {
  const payment = await Payment.findOne({
    where: {
      orderId: order.id,
      status: { [Op.in]: [PaymentStatus.COMPLETED, PaymentStatus.PARTIALLY_REFUNDED] },
    },
    order: [['createdAt', 'DESC']],
  });
  if (!payment) return;

  const refundableAmount = Number(payment.amount) - Number(payment.refundedAmount || 0);
  if (refundableAmount <= 0) return;

  if (payment.method === PaymentMethod.CARD && payment.stripeChargeId) {
    await stripe.refunds.create({
      charge: payment.stripeChargeId,
      amount: Math.round(refundableAmount * 100),
    });
  } else if (payment.method === PaymentMethod.WALLET) {
    const wallet = await Wallet.findOne({ where: { userId: payment.userId } });
    if (wallet) {
      const newBalance = Number(wallet.balance) + refundableAmount;
      await wallet.update({ balance: newBalance });
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

  await payment.update({
    status: PaymentStatus.REFUNDED,
    refundedAmount: Number(payment.refundedAmount || 0) + refundableAmount,
    refundReason: reason,
    refundedAt: new Date(),
  });
};

/**
 * @route   GET /api/v1/orders
 * @desc    Get user's orders (customers) or all orders (admin)
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { page = '1', limit = '10', status, startDate, endDate, search } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 10, 50);
    const offset = (pageNum - 1) * limitNum;

    const where: any = {};

    // Non-admin users can only see their own orders
    const adminRoles = [UserRole.ADMIN_SUPER, UserRole.ADMIN_OPERATIONS, UserRole.ADMIN_SUPPORT];
    if (!adminRoles.includes(req.user!.role as UserRole)) {
      where.userId = req.user!.userId;
    }

    if (status) {
      where.status = status;
    }

    if (startDate && endDate) {
      where.createdAt = {
        [Op.between]: [new Date(startDate as string), new Date(endDate as string)],
      };
    }

    if (search) {
      where.orderNumber = { [Op.iLike]: `%${search}%` };
    }

    const { count, rows: orders } = await Order.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset,
      include: [
        { model: User, as: 'user', include: [{ model: UserProfile, as: 'profile' }] },
        { model: Address, as: 'deliveryAddress' },
        { model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'city'] },
      ],
    });

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

/**
 * @route   GET /api/v1/orders/:id
 * @desc    Get order by ID (UUID) or orderNumber (JM-XXXX-XXXX)
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    // FIX: Support both UUID and orderNumber lookups
    const whereClause = isValidUUID(id) ? { id } : { orderNumber: id };

    const order = await Order.findOne({
      where: whereClause,
      include: [
        { model: User, as: 'user', include: [{ model: UserProfile, as: 'profile' }] },
        { model: Address, as: 'deliveryAddress' },
        { model: Warehouse, as: 'warehouse' },
        { model: OrderItem, as: 'orderItems', include: [{ model: Medicine, as: 'medicine' }] },
        { model: Payment, as: 'payments' },
        { model: User, as: 'reviewer', include: [{ model: UserProfile, as: 'profile' }] },
        { model: User, as: 'deliveryPartner', include: [{ model: UserProfile, as: 'profile' }] },
      ],
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Check ownership unless admin
    const adminRoles = [UserRole.ADMIN_SUPER, UserRole.ADMIN_OPERATIONS, UserRole.ADMIN_SUPPORT, UserRole.PHARMACIST, UserRole.SENIOR_PHARMACIST, UserRole.DELIVERY_PARTNER, UserRole.WAREHOUSE_STAFF];
    if (!adminRoles.includes(req.user!.role as UserRole) && order.userId !== req.user!.userId) {
      throw new ForbiddenError('Access denied');
    }

    const prescriptionIds = Array.isArray(order.prescriptionIds) ? order.prescriptionIds : [];
    const prescriptions = prescriptionIds.length
      ? await Prescription.findAll({
          where: { id: { [Op.in]: prescriptionIds } },
          attributes: ['id', 'filePath', 'status', 'createdAt'],
          order: [['createdAt', 'DESC']],
        })
      : [];

    const prescriptionsForClient = prescriptions.map((prescription: any) => ({
      ...prescription.toJSON(),
      imageUrl: prescription.filePath ? getFileUrl(prescription.filePath) : null,
    }));

    res.json({ success: true, data: { order, prescriptions: prescriptionsForClient } });
  })
);

router.get(
  '/:id/invoice',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const whereClause = isValidUUID(id) ? { id } : { orderNumber: id };
    const order = await Order.findOne({ where: whereClause });
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
  })
);

/**
 * @route   POST /api/v1/orders
 * @desc    Create a new order
 * @access  Private/Customer
 */
router.post(
  '/',
  authenticate,
  authorize(UserRole.CUSTOMER),
  [
    body('addressId').isUUID().withMessage('Valid address ID is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.medicineId').isUUID().withMessage('Valid medicine ID is required'),
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

    // Verify address belongs to user
    const address = await Address.findOne({
      where: { id: addressId, userId: req.user!.userId },
    });
    if (!address) {
      throw new BadRequestError('Invalid address');
    }

    // Find nearest warehouse (simplified - just pick active one)
    const warehouse = await Warehouse.findOne({ where: { isActive: true } });
    if (!warehouse) {
      throw new BadRequestError('No warehouse available for delivery');
    }

    // Process items and calculate totals
    let subtotal = 0;
    let prescriptionRequired = false;
    const orderItems: any[] = [];

    for (const item of items) {
      const medicine = await Medicine.findByPk(item.medicineId);
      if (!medicine || !medicine.isActive) {
        throw new BadRequestError(`Medicine not found: ${item.medicineId}`);
      }

      const dosageOption = medicine.dosageOptions.find((d: any) => d.id === item.dosageOptionId);
      if (!dosageOption) {
        throw new BadRequestError(`Invalid dosage option for ${medicine.name}`);
      }

      // Check inventory
      const inventory = await Inventory.findOne({
        where: {
          medicineId: medicine.id,
          dosageOptionId: item.dosageOptionId,
          warehouseId: warehouse.id,
        },
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

      // Reserve inventory
      await inventory.update({
        reservedQuantity: inventory.reservedQuantity + item.quantity,
      });
    }

    // FIX: Use only valid DeliveryType enum values (STANDARD, EXPRESS, EMERGENCY, SCHEDULED)
    const deliveryFees: Record<string, number> = {
      [DeliveryType.EXPRESS]: 9.99,
      [DeliveryType.STANDARD]: 5.99,
      [DeliveryType.SCHEDULED]: 3.99,
      [DeliveryType.EMERGENCY]: 14.99,
    };

    const deliveryFee = subtotal >= 50 ? 0 : deliveryFees[deliveryType] || 5.99;
    const platformFee = 1.99;
    const taxAmount = subtotal * 0.08;
    const discountAmount = 0; // TODO: Apply promo code
    const totalAmount = subtotal + deliveryFee + platformFee + taxAmount - discountAmount + tipAmount;

    // Create order
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

    // Create order items
    for (const item of orderItems) {
      await OrderItem.create({
        orderId: order.id,
        ...item,
      });
    }

    // Notify using available socket functions
    const io = req.app.get('io');
    if (prescriptionRequired && io) {
      // Emit to pharmacist role room (role:pharmacist is joined on connection)
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

/**
 * @route   PATCH /api/v1/orders/:id/status
 * @desc    Update order status
 * @access  Private/Staff
 */
router.patch(
  '/:id/status',
  authenticate,
  authorize(UserRole.PHARMACIST, UserRole.SENIOR_PHARMACIST, UserRole.WAREHOUSE_STAFF, UserRole.DELIVERY_PARTNER, UserRole.ADMIN_SUPER, UserRole.ADMIN_OPERATIONS),
  body('status').isIn(Object.values(OrderStatus)).withMessage('Invalid status'),
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', errors.array());
    }

    const { id } = req.params;
    const { status, notes, rejectionReason } = req.body;

    // FIX: Support both UUID and orderNumber
    const whereClause = isValidUUID(id) ? { id } : { orderNumber: id };
    const order = await Order.findOne({ where: whereClause });
    
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    const previousStatus = order.status;
    const updateData: any = { status };
    const io = req.app.get('io');

    switch (status) {
      case OrderStatus.APPROVED:
        updateData.reviewedBy = req.user!.userId;
        updateData.reviewedAt = new Date();
        updateData.pharmacistNotes = notes;
        // Emit to warehouse staff
        if (io) {
          io.to('role:warehouse_staff').emit('order:approved', { orderId: order.id, orderNumber: order.orderNumber });
        }
        break;

      case OrderStatus.REJECTED:
        updateData.reviewedBy = req.user!.userId;
        updateData.reviewedAt = new Date();
        updateData.pharmacistNotes = rejectionReason;
        await processOrderRefund(order, rejectionReason || 'Order rejected by pharmacist');
        break;

      case OrderStatus.PACKING:
        updateData.packedBy = req.user!.userId;
        break;

      case OrderStatus.PACKED:
        updateData.packedAt = new Date();
        break;

      case OrderStatus.OUT_FOR_DELIVERY:
        updateData.deliveryPartnerId = req.user!.userId;
        updateData.deliveryStartedAt = new Date();
        break;

      case OrderStatus.DELIVERED:
        updateData.deliveredAt = new Date();
        // Release reserved inventory
        for (const item of order.items) {
          const inventory = await Inventory.findOne({
            where: { medicineId: item.medicineId, dosageOptionId: item.dosageOptionId, warehouseId: order.warehouseId },
          });
          if (inventory) {
            await inventory.update({
              quantity: inventory.quantity - item.quantity,
              reservedQuantity: inventory.reservedQuantity - item.quantity,
            });
          }
        }
        break;

      case OrderStatus.CANCELLED:
        updateData.cancelledBy = req.user!.userId;
        updateData.cancelledAt = new Date();
        updateData.cancellationReason = notes;
        // Release reserved inventory
        for (const item of order.items) {
          const inventory = await Inventory.findOne({
            where: { medicineId: item.medicineId, dosageOptionId: item.dosageOptionId, warehouseId: order.warehouseId },
          });
          if (inventory) {
            await inventory.update({
              reservedQuantity: Math.max(0, inventory.reservedQuantity - item.quantity),
            });
          }
        }
        break;
    }

    await order.update(updateData);

    // Notify customer
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

/**
 * @route   POST /api/v1/orders/:id/cancel
 * @desc    Cancel order (Customer)
 * @access  Private/Customer
 */
router.post(
  '/:id/cancel',
  authenticate,
  body('reason').notEmpty().withMessage('Cancellation reason is required'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;

    // FIX: Support both UUID and orderNumber
    const whereClause = isValidUUID(id) ? { id } : { orderNumber: id };
    const order = await Order.findOne({ where: whereClause });
    
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (order.userId !== req.user!.userId) {
      throw new ForbiddenError('Access denied');
    }

    // Can only cancel in certain statuses
    const cancellableStatuses = [OrderStatus.PLACED, OrderStatus.PENDING_REVIEW, OrderStatus.APPROVED];
    if (!cancellableStatuses.includes(order.status)) {
      throw new BadRequestError('Order cannot be cancelled at this stage');
    }

    // Update status
    await order.update({
      status: OrderStatus.CANCELLED,
      cancellationReason: reason,
      cancelledBy: req.user!.userId,
      cancelledAt: new Date(),
    });

    // Release reserved inventory
    for (const item of order.items) {
      const inventory = await Inventory.findOne({
        where: { medicineId: item.medicineId, dosageOptionId: item.dosageOptionId, warehouseId: order.warehouseId },
      });
      if (inventory) {
        await inventory.update({
          reservedQuantity: Math.max(0, inventory.reservedQuantity - item.quantity),
        });
      }
    }

    // TODO: Process refund
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

/**
 * @route   POST /api/v1/orders/:id/verify-otp
 * @desc    Verify delivery OTP
 * @access  Private/Delivery Partner
 */
router.post(
  '/:id/verify-otp',
  authenticate,
  authorize(UserRole.DELIVERY_PARTNER),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('Invalid OTP'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { otp } = req.body;

    // FIX: Support both UUID and orderNumber
    const whereClause = isValidUUID(id) ? { id } : { orderNumber: id };
    const order = await Order.findOne({ where: whereClause });
    
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

/**
 * @route   GET /api/v1/orders/stats/summary
 * @desc    Get order statistics
 * @access  Private/Admin
 */
router.get(
  '/stats/summary',
  authenticate,
  authorize(UserRole.ADMIN_SUPER, UserRole.ADMIN_OPERATIONS, UserRole.ADMIN_FINANCE),
  asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    const dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        [Op.between]: [new Date(startDate as string), new Date(endDate as string)],
      };
    }

    const totalOrders = await Order.count({ where: dateFilter });
    const completedOrders = await Order.count({ where: { ...dateFilter, status: OrderStatus.DELIVERED } });
    const cancelledOrders = await Order.count({ where: { ...dateFilter, status: OrderStatus.CANCELLED } });
    const pendingOrders = await Order.count({ where: { ...dateFilter, status: { [Op.in]: [OrderStatus.PLACED, OrderStatus.PENDING_REVIEW, OrderStatus.APPROVED, OrderStatus.PACKING] } } });

    const revenue = await Order.sum('totalAmount', { where: { ...dateFilter, status: OrderStatus.DELIVERED } }) || 0;

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

export default router;