import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Stripe from 'stripe';

import { Payment, Order, Wallet, WalletTransaction, User } from '../models/index.js';
import { asyncHandler, BadRequestError, NotFoundError } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import config from '../config/index.js';
import { PaymentMethod, PaymentStatus, OrderStatus, UserRole } from '../types/index.js';

const router = Router();
const DEMO_WALLET_STARTER_BALANCE = 100;

// Initialize Stripe
const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2023-10-16',
});

/**
 * @route   POST /api/v1/payments/create-intent
 * @desc    Create a payment intent
 * @access  Private
 */
router.post(
  '/create-intent',
  authenticate,
  body('orderId').isUUID().withMessage('Valid order ID is required'),
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', errors.array());
    }

    const { orderId } = req.body;

    // Get order
    const order = await Order.findByPk(orderId);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (order.userId !== req.user!.userId) {
      throw new BadRequestError('Unauthorized');
    }

    // Check if already paid
    const existingPayment = await Payment.findOne({
      where: { orderId, status: PaymentStatus.COMPLETED },
    });
    if (existingPayment) {
      throw new BadRequestError('Order already paid');
    }

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.totalAmount * 100),
      currency: 'usd',
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId: req.user!.userId,
      },
    });

    // Create pending payment record
    await Payment.create({
      orderId: order.id,
      userId: req.user!.userId,
      method: PaymentMethod.CARD,
      status: PaymentStatus.PENDING,
      amount: order.totalAmount,
      currency: 'USD',
      stripePaymentIntentId: paymentIntent.id,
    });

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: order.totalAmount,
      },
    });
  })
);

/**
 * @route   POST /api/v1/payments/confirm
 * @desc    Confirm payment after Stripe success
 * @access  Private
 */
router.post(
  '/confirm',
  authenticate,
  body('paymentIntentId').notEmpty().withMessage('Payment intent ID is required'),
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', errors.array());
    }

    const { paymentIntentId } = req.body;

    // Verify with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new BadRequestError('Payment not completed');
    }

    // Update payment record
    const payment = await Payment.findOne({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    await payment.update({
      status: PaymentStatus.COMPLETED,
      stripeChargeId: paymentIntent.latest_charge as string,
      cardLast4: paymentIntent.payment_method_types?.[0] === 'card' ? '****' : undefined,
    });

    // Update order status if it's a new order
    const order = await Order.findByPk(payment.orderId);
    if (order && order.status === OrderStatus.PLACED) {
      await order.update({
        status: order.prescriptionRequired ? OrderStatus.PENDING_REVIEW : OrderStatus.APPROVED,
      });
    }

    res.json({
      success: true,
      message: 'Payment confirmed',
      data: { payment },
    });
  })
);

/**
 * @route   POST /api/v1/payments/wallet/pay
 * @desc    Pay with wallet balance
 * @access  Private
 */
router.post(
  '/wallet/pay',
  authenticate,
  body('orderId').isUUID().withMessage('Valid order ID is required'),
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', errors.array());
    }

    const { orderId } = req.body;

    // Get order
    const order = await Order.findByPk(orderId);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (order.userId !== req.user!.userId) {
      throw new BadRequestError('Unauthorized');
    }

    // Get wallet
    const wallet = await Wallet.findOne({ where: { userId: req.user!.userId } });
    if (!wallet) {
      throw new BadRequestError('Wallet not found');
    }

    // DECIMAL columns often arrive as strings; numeric compare avoids "100.00" < "27.84" (lexicographic) bugs
    const balance = Number(wallet.balance);
    const orderTotal = Number(order.totalAmount);
    if (Number.isNaN(balance) || Number.isNaN(orderTotal)) {
      throw new BadRequestError('Invalid wallet or order amount');
    }
    if (balance < orderTotal) {
      throw new BadRequestError(
        `Insufficient wallet balance. Required $${orderTotal.toFixed(2)}, available $${balance.toFixed(2)}`
      );
    }

    // Deduct from wallet
    const newBalance = balance - orderTotal;
    await wallet.update({ balance: newBalance });

    // Create transaction record
    const transaction = await WalletTransaction.create({
      walletId: wallet.id,
      type: 'debit',
      amount: orderTotal,
      description: `Payment for order ${order.orderNumber}`,
      referenceType: 'order',
      referenceId: order.id,
      balanceAfter: newBalance,
    });

    // Create payment record
    const payment = await Payment.create({
      orderId: order.id,
      userId: req.user!.userId,
      method: PaymentMethod.WALLET,
      status: PaymentStatus.COMPLETED,
      amount: orderTotal,
      currency: 'USD',
      walletTransactionId: transaction.id,
    });

    // Update order status
    await order.update({
      status: order.prescriptionRequired ? OrderStatus.PENDING_REVIEW : OrderStatus.APPROVED,
    });

    res.json({
      success: true,
      message: 'Payment successful',
      data: {
        payment,
        newBalance,
      },
    });
  })
);

/**
 * @route   POST /api/v1/payments/refund
 * @desc    Process refund
 * @access  Private/Admin
 */
router.post(
  '/refund',
  authenticate,
  authorize(UserRole.ADMIN_SUPER, UserRole.ADMIN_FINANCE),
  [
    body('paymentId').isUUID().withMessage('Valid payment ID is required'),
    body('amount').optional().isFloat({ min: 0.01 }).withMessage('Invalid amount'),
    body('reason').notEmpty().withMessage('Reason is required'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', errors.array());
    }

    const { paymentId, amount, reason } = req.body;

    const payment = await Payment.findByPk(paymentId);
    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestError('Payment cannot be refunded');
    }

    const refundAmount = amount || payment.amount;

    if (refundAmount > payment.amount - (payment.refundedAmount || 0)) {
      throw new BadRequestError('Refund amount exceeds available amount');
    }

    // Process refund based on payment method
    if (payment.method === PaymentMethod.CARD && payment.stripeChargeId) {
      // Stripe refund
      await stripe.refunds.create({
        charge: payment.stripeChargeId,
        amount: Math.round(refundAmount * 100),
      });
    } else if (payment.method === PaymentMethod.WALLET) {
      // Wallet refund
      const wallet = await Wallet.findOne({ where: { userId: payment.userId } });
      if (wallet) {
        const newBalance = Number(wallet.balance || 0) + Number(refundAmount);
        await wallet.update({ balance: newBalance });

        await WalletTransaction.create({
          walletId: wallet.id,
          type: 'credit',
          amount: refundAmount,
          description: `Refund for payment ${paymentId}`,
          referenceType: 'refund',
          referenceId: payment.id,
          balanceAfter: newBalance,
        });
      }
    }

    // Update payment record
    await payment.update({
      status: refundAmount >= payment.amount ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
      refundedAmount: (payment.refundedAmount || 0) + refundAmount,
      refundReason: reason,
      refundedAt: new Date(),
    });

    res.json({
      success: true,
      message: 'Refund processed successfully',
      data: { payment },
    });
  })
);

/**
 * @route   GET /api/v1/payments/wallet
 * @desc    Get wallet details
 * @access  Private
 */
router.get(
  '/wallet',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    let wallet = await Wallet.findOne({
      where: { userId: req.user!.userId },
      include: [
        {
          model: WalletTransaction,
          as: 'transactions',
          limit: 10,
          order: [['createdAt', 'DESC']],
        },
      ],
    });

    if (!wallet) {
      wallet = await Wallet.create({
        userId: req.user!.userId,
        balance: DEMO_WALLET_STARTER_BALANCE,
        currency: 'USD',
      });

      await WalletTransaction.create({
        walletId: wallet.id,
        type: 'credit',
        amount: DEMO_WALLET_STARTER_BALANCE,
        description: 'Demo starter wallet balance',
        referenceType: 'promo',
        balanceAfter: DEMO_WALLET_STARTER_BALANCE,
      });
    } else if (Number(wallet.balance || 0) <= 0) {
      const hasStarterCredit = await WalletTransaction.findOne({
        where: {
          walletId: wallet.id,
          description: 'Demo starter wallet balance',
        },
      });

      if (!hasStarterCredit) {
        const newBalance = Number(wallet.balance || 0) + DEMO_WALLET_STARTER_BALANCE;
        await wallet.update({ balance: newBalance });
        await WalletTransaction.create({
          walletId: wallet.id,
          type: 'credit',
          amount: DEMO_WALLET_STARTER_BALANCE,
          description: 'Demo starter wallet balance',
          referenceType: 'promo',
          balanceAfter: newBalance,
        });
      }
    }

    // Re-fetch wallet to include fresh transactions ordering
    wallet = await Wallet.findOne({
      where: { userId: req.user!.userId },
      include: [
        {
          model: WalletTransaction,
          as: 'transactions',
          limit: 10,
          order: [['createdAt', 'DESC']],
        },
      ],
    });

    res.json({
      success: true,
      data: { wallet },
    });
  })
);

/**
 * @route   POST /api/v1/payments/wallet/add
 * @desc    Add funds to wallet
 * @access  Private
 */
router.post(
  '/wallet/add',
  authenticate,
  body('amount').isFloat({ min: 5, max: 500 }).withMessage('Amount must be between $5 and $500'),
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', errors.array());
    }

    const { amount } = req.body;
    let wallet = await Wallet.findOne({ where: { userId: req.user!.userId } });
    if (!wallet) {
      wallet = await Wallet.create({
        userId: req.user!.userId,
        balance: 0,
        currency: 'USD',
      });
    }

    const newBalance = Number(wallet.balance || 0) + Number(amount);
    await wallet.update({ balance: newBalance });
    const transaction = await WalletTransaction.create({
      walletId: wallet.id,
      type: 'credit',
      amount: Number(amount),
      description: 'Wallet top-up',
      referenceType: 'topup',
      balanceAfter: newBalance,
    });

    res.json({
      success: true,
      data: {
        amount: Number(amount),
        newBalance,
        transaction,
      },
    });
  })
);

/**
 * @route   POST /api/v1/payments/webhook
 * @desc    Stripe webhook handler
 * @access  Public (Stripe only)
 */
router.post(
  '/webhook',
  asyncHandler(async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        config.stripe.webhookSecret
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Handle wallet top-up
        if (paymentIntent.metadata.type === 'wallet_topup') {
          const wallet = await Wallet.findOne({
            where: { userId: paymentIntent.metadata.userId },
          });
          
          if (wallet) {
            const amount = paymentIntent.amount / 100;
            const newBalance = Number(wallet.balance || 0) + amount;
            await wallet.update({ balance: newBalance });

            await WalletTransaction.create({
              walletId: wallet.id,
              type: 'credit',
              amount,
              description: 'Wallet top-up',
              referenceType: 'topup',
              referenceId: paymentIntent.id,
              balanceAfter: newBalance,
            });
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        const payment = await Payment.findOne({
          where: { stripePaymentIntentId: paymentIntent.id },
        });
        
        if (payment) {
          await payment.update({
            status: PaymentStatus.FAILED,
            failureReason: paymentIntent.last_payment_error?.message,
          });
        }
        break;
      }
    }

    res.json({ received: true });
  })
);

/**
 * @route   GET /api/v1/payments/history
 * @desc    Get payment history
 * @access  Private
 */
router.get(
  '/history',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 10, 50);
    const offset = (pageNum - 1) * limitNum;

    const { count, rows: payments } = await Payment.findAndCountAll({
      where: { userId: req.user!.userId },
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset,
      include: [
        { model: Order, as: 'order', attributes: ['id', 'orderNumber', 'status'] },
      ],
    });

    res.json({
      success: true,
      data: {
        payments,
        total: count,
        page: pageNum,
        totalPages: Math.ceil(count / limitNum),
      },
    });
  })
);

export default router;
