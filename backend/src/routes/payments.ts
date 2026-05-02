// @ts-nocheck
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Stripe from 'stripe';

import { Payment, Order, Wallet, WalletTransaction } from '../models/index.js';
import { asyncHandler, BadRequestError, NotFoundError } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import config from '../config/index.js';
import { PaymentMethod, PaymentStatus, OrderStatus, UserRole } from '../types/index.js';

const router = Router();
const DEMO_WALLET_STARTER_BALANCE = 100;

const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return typeof str === 'string' && uuidRegex.test(str.trim());
};

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2023-10-16',
});

/** Registered in `index.ts` with `express.raw` — Stripe signature verification requires unparsed body. */
export const stripeWebhookHandler = asyncHandler(async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    const payload = req.body as Buffer | string;
    event = stripe.webhooks.constructEvent(payload, sig, config.stripe.webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Webhook signature verification failed:', msg);
    return res.status(400).send(`Webhook Error: ${msg}`);
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      if (paymentIntent.metadata.type === 'wallet_topup') {
        const wallet = await Wallet.findOne({
          userId: paymentIntent.metadata.userId,
        });

        if (wallet) {
          const amount = paymentIntent.amount / 100;
          const newBalance = Number(wallet.balance || 0) + amount;
          wallet.balance = newBalance;
          await wallet.save();

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
        stripePaymentIntentId: paymentIntent.id,
      });

      if (payment) {
        payment.status = PaymentStatus.FAILED;
        payment.failureReason = paymentIntent.last_payment_error?.message;
        await payment.save();
      }
      break;
    }
    default:
      break;
  }

  res.json({ received: true });
});

async function loadWalletWithTransactions(userId: string) {
  const wallet = await Wallet.findOne({ userId });
  if (!wallet) return null;
  const transactions = await WalletTransaction.find({ walletId: wallet.id })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
  const w = wallet.toJSON();
  return { ...w, transactions };
}

router.post(
  '/create-intent',
  authenticate,
  body('orderId')
    .isString()
    .trim()
    .custom((value) => isValidUUID(value))
    .withMessage('Valid order ID is required'),
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', errors.array());
    }

    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (order.userId !== req.user!.userId) {
      throw new BadRequestError('Unauthorized');
    }

    const existingPayment = await Payment.findOne({
      orderId: order.id,
      status: PaymentStatus.COMPLETED,
    });
    if (existingPayment) {
      throw new BadRequestError('Order already paid');
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.totalAmount * 100),
      currency: 'usd',
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId: req.user!.userId,
      },
    });

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

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new BadRequestError('Payment not completed');
    }

    const payment = await Payment.findOne({
      stripePaymentIntentId: paymentIntentId,
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    payment.status = PaymentStatus.COMPLETED;
    payment.stripeChargeId = paymentIntent.latest_charge as string;
    payment.cardLast4 =
      paymentIntent.payment_method_types?.[0] === 'card' ? '****' : undefined;
    await payment.save();

    const order = await Order.findById(payment.orderId);
    if (order && order.status === OrderStatus.PLACED) {
      order.status = order.prescriptionRequired ? OrderStatus.PENDING_REVIEW : OrderStatus.APPROVED;
      await order.save();
    }

    res.json({
      success: true,
      message: 'Payment confirmed',
      data: { payment },
    });
  })
);

router.post(
  '/wallet/pay',
  authenticate,
  body('orderId')
    .isString()
    .trim()
    .custom((value) => isValidUUID(value))
    .withMessage('Valid order ID is required'),
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', errors.array());
    }

    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (order.userId !== req.user!.userId) {
      throw new BadRequestError('Unauthorized');
    }

    const wallet = await Wallet.findOne({ userId: req.user!.userId });
    if (!wallet) {
      throw new BadRequestError('Wallet not found');
    }

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

    const newBalance = balance - orderTotal;
    wallet.balance = newBalance;
    await wallet.save();

    const transaction = await WalletTransaction.create({
      walletId: wallet.id,
      type: 'debit',
      amount: orderTotal,
      description: `Payment for order ${order.orderNumber}`,
      referenceType: 'order',
      referenceId: order.id,
      balanceAfter: newBalance,
    });

    const payment = await Payment.create({
      orderId: order.id,
      userId: req.user!.userId,
      method: PaymentMethod.WALLET,
      status: PaymentStatus.COMPLETED,
      amount: orderTotal,
      currency: 'USD',
      walletTransactionId: transaction.id,
    });

    order.status = order.prescriptionRequired ? OrderStatus.PENDING_REVIEW : OrderStatus.APPROVED;
    await order.save();

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

router.post(
  '/refund',
  authenticate,
  authorize(UserRole.ADMIN_SUPER, UserRole.ADMIN_FINANCE),
  [
    body('paymentId')
      .isString()
      .trim()
      .custom((value) => isValidUUID(value))
      .withMessage('Valid payment ID is required'),
    body('amount').optional().isFloat({ min: 0.01 }).withMessage('Invalid amount'),
    body('reason').notEmpty().withMessage('Reason is required'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', errors.array());
    }

    const { paymentId, amount, reason } = req.body;

    const payment = await Payment.findById(paymentId);
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

    if (payment.method === PaymentMethod.CARD && payment.stripeChargeId) {
      await stripe.refunds.create({
        charge: payment.stripeChargeId,
        amount: Math.round(refundAmount * 100),
      });
    } else if (payment.method === PaymentMethod.WALLET) {
      const wallet = await Wallet.findOne({ userId: payment.userId });
      if (wallet) {
        const newBalance = Number(wallet.balance || 0) + Number(refundAmount);
        wallet.balance = newBalance;
        await wallet.save();

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

    payment.status = refundAmount >= payment.amount ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;
    payment.refundedAmount = (payment.refundedAmount || 0) + refundAmount;
    payment.refundReason = reason;
    payment.refundedAt = new Date();
    await payment.save();

    res.json({
      success: true,
      message: 'Refund processed successfully',
      data: { payment },
    });
  })
);

router.get(
  '/wallet',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    let wallet = await Wallet.findOne({ userId: req.user!.userId });

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
        walletId: wallet.id,
        description: 'Demo starter wallet balance',
      });

      if (!hasStarterCredit) {
        const newBalance = Number(wallet.balance || 0) + DEMO_WALLET_STARTER_BALANCE;
        wallet.balance = newBalance;
        await wallet.save();
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

    const payload = await loadWalletWithTransactions(req.user!.userId);

    res.json({
      success: true,
      data: { wallet: payload },
    });
  })
);

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
    let wallet = await Wallet.findOne({ userId: req.user!.userId });
    if (!wallet) {
      wallet = await Wallet.create({
        userId: req.user!.userId,
        balance: 0,
        currency: 'USD',
      });
    }

    const newBalance = Number(wallet.balance || 0) + Number(amount);
    wallet.balance = newBalance;
    await wallet.save();
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

router.get(
  '/history',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 10, 50);
    const skip = (pageNum - 1) * limitNum;

    const filter = { userId: req.user!.userId };
    const count = await Payment.countDocuments(filter);
    const payments = await Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate({ path: 'order', select: 'orderNumber status' });

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
