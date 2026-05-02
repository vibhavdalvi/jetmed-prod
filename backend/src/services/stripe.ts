// @ts-nocheck
/**
 * ============================================
 * STRIPE PAYMENT SERVICE
 * ============================================
 * Complete Stripe integration for:
 * - Payment Intent creation
 * - Customer management
 * - Refunds
 * - Webhooks
 * - Wallet top-ups
 * 
 * Based on 38 Questions: Q9 - Payment System
 * - Cards, Net Banking, UPI, Digital Wallets
 * - Wallet within app (preload balance)
 * - Refund scenarios
 */

import Stripe from 'stripe';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

// ============================================
// TYPES
// ============================================

export interface CreatePaymentIntentParams {
  orderId: string;
  amount: number; // Amount in cents
  currency?: string;
  customerId?: string;
  metadata?: Record<string, string>;
  paymentMethodTypes?: string[];
}

export interface RefundParams {
  paymentIntentId: string;
  amount?: number; // Partial refund amount in cents (optional)
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  metadata?: Record<string, string>;
}

export interface WalletTopUpParams {
  userId: string;
  amount: number;
  paymentMethodId: string;
}

// ============================================
// CUSTOMER MANAGEMENT
// ============================================

/**
 * Create or retrieve a Stripe customer
 */
export const createOrGetCustomer = async (
  email: string,
  name: string,
  phone?: string,
  metadata?: Record<string, string>
): Promise<Stripe.Customer> => {
  // Check if customer already exists
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0];
  }

  // Create new customer
  return stripe.customers.create({
    email,
    name,
    phone,
    metadata: {
      source: 'JetMed',
      ...metadata,
    },
  });
};

/**
 * Update customer information
 */
export const updateCustomer = async (
  customerId: string,
  updates: Stripe.CustomerUpdateParams
): Promise<Stripe.Customer> => {
  return stripe.customers.update(customerId, updates);
};

/**
 * Delete customer (GDPR compliance)
 */
export const deleteCustomer = async (customerId: string): Promise<Stripe.DeletedCustomer> => {
  return stripe.customers.del(customerId);
};

// ============================================
// PAYMENT METHODS
// ============================================

/**
 * Attach payment method to customer
 */
export const attachPaymentMethod = async (
  paymentMethodId: string,
  customerId: string
): Promise<Stripe.PaymentMethod> => {
  return stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });
};

/**
 * Set default payment method for customer
 */
export const setDefaultPaymentMethod = async (
  customerId: string,
  paymentMethodId: string
): Promise<Stripe.Customer> => {
  return stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });
};

/**
 * List customer's payment methods
 */
export const listPaymentMethods = async (
  customerId: string,
  type: Stripe.PaymentMethodListParams.Type = 'card'
): Promise<Stripe.PaymentMethod[]> => {
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type,
  });
  return paymentMethods.data;
};

/**
 * Detach payment method from customer
 */
export const detachPaymentMethod = async (
  paymentMethodId: string
): Promise<Stripe.PaymentMethod> => {
  return stripe.paymentMethods.detach(paymentMethodId);
};

// ============================================
// PAYMENT INTENTS
// ============================================

/**
 * Create a payment intent for order checkout
 * Per Q9: Payment happens BEFORE pharmacist review
 */
export const createPaymentIntent = async (
  params: CreatePaymentIntentParams
): Promise<Stripe.PaymentIntent> => {
  const {
    orderId,
    amount,
    currency = 'usd',
    customerId,
    metadata = {},
    paymentMethodTypes = ['card'],
  } = params;

  const intentParams: Stripe.PaymentIntentCreateParams = {
    amount,
    currency,
    payment_method_types: paymentMethodTypes,
    metadata: {
      orderId,
      source: 'JetMed',
      ...metadata,
    },
  };

  if (customerId) {
    intentParams.customer = customerId;
  }

  return stripe.paymentIntents.create(intentParams);
};

/**
 * Retrieve payment intent
 */
export const getPaymentIntent = async (
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> => {
  return stripe.paymentIntents.retrieve(paymentIntentId);
};

/**
 * Confirm payment intent
 */
export const confirmPaymentIntent = async (
  paymentIntentId: string,
  paymentMethodId?: string
): Promise<Stripe.PaymentIntent> => {
  const confirmParams: Stripe.PaymentIntentConfirmParams = {};
  
  if (paymentMethodId) {
    confirmParams.payment_method = paymentMethodId;
  }

  return stripe.paymentIntents.confirm(paymentIntentId, confirmParams);
};

/**
 * Cancel payment intent
 */
export const cancelPaymentIntent = async (
  paymentIntentId: string,
  cancellationReason?: string
): Promise<Stripe.PaymentIntent> => {
  return stripe.paymentIntents.cancel(paymentIntentId, {
    cancellation_reason: 'requested_by_customer',
  });
};

// ============================================
// REFUNDS
// ============================================

/**
 * Process refund
 * Per Q9: Various refund scenarios
 * - Prescription rejected → Full refund
 * - Order cancelled before packing → Full refund
 * - Order cancelled after packing → Partial refund
 * - Medicine unavailable → Full refund + discount coupon
 */
export const createRefund = async (params: RefundParams): Promise<Stripe.Refund> => {
  const { paymentIntentId, amount, reason = 'requested_by_customer', metadata = {} } = params;

  const refundParams: Stripe.RefundCreateParams = {
    payment_intent: paymentIntentId,
    reason,
    metadata: {
      source: 'JetMed',
      ...metadata,
    },
  };

  if (amount) {
    refundParams.amount = amount; // Partial refund
  }

  return stripe.refunds.create(refundParams);
};

/**
 * Retrieve refund
 */
export const getRefund = async (refundId: string): Promise<Stripe.Refund> => {
  return stripe.refunds.retrieve(refundId);
};

/**
 * List refunds for a payment intent
 */
export const listRefunds = async (paymentIntentId: string): Promise<Stripe.Refund[]> => {
  const refunds = await stripe.refunds.list({
    payment_intent: paymentIntentId,
  });
  return refunds.data;
};

// ============================================
// WALLET TOP-UPS (JetMed Wallet)
// ============================================

/**
 * Process wallet top-up payment
 * Per Q9: Wallet within app (preload balance)
 */
export const processWalletTopUp = async (
  params: WalletTopUpParams
): Promise<Stripe.PaymentIntent> => {
  const { userId, amount, paymentMethodId } = params;

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    payment_method: paymentMethodId,
    confirm: true,
    metadata: {
      type: 'wallet_topup',
      userId,
      source: 'JetMed',
    },
    return_url: `${process.env.FRONTEND_URL}/wallet/topup/success`,
  });

  return paymentIntent;
};

// ============================================
// WEBHOOKS
// ============================================

/**
 * Verify webhook signature
 */
export const verifyWebhookSignature = (
  payload: string | Buffer,
  signature: string
): Stripe.Event => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    throw new Error('Stripe webhook secret not configured');
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
};

/**
 * Handle webhook events
 */
export const handleWebhookEvent = async (event: Stripe.Event): Promise<void> => {
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`💰 Payment succeeded for order: ${paymentIntent.metadata.orderId}`);
      // Update order status, send confirmation email, etc.
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object as Stripe.PaymentIntent;
      console.log(`❌ Payment failed for order: ${failedPayment.metadata.orderId}`);
      // Notify user, update order status
      break;

    case 'refund.created':
      const refund = event.data.object as Stripe.Refund;
      console.log(`💸 Refund created: ${refund.id}`);
      // Update order status, notify user
      break;

    case 'customer.subscription.deleted':
      // Handle subscription cancellation if implementing subscriptions
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert dollars to cents
 */
export const dollarsToCents = (dollars: number): number => {
  return Math.round(dollars * 100);
};

/**
 * Convert cents to dollars
 */
export const centsToDollars = (cents: number): number => {
  return cents / 100;
};

/**
 * Calculate order total with fees
 * Per Q9: Delivery fees vary by speed
 */
export const calculateOrderTotal = (
  subtotal: number,
  deliveryType: 'standard' | 'express' | 'emergency' | 'scheduled',
  walletBalance: number = 0,
  promoDiscount: number = 0
): {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  walletUsed: number;
  cardCharge: number;
  total: number;
} => {
  // Delivery fees per Q9
  const deliveryFees: Record<string, number> = {
    standard: 2.99,
    express: 5.99,
    emergency: 9.99,
    scheduled: 0, // Free scheduled delivery
  };

  const deliveryFee = deliveryFees[deliveryType];
  const grossTotal = subtotal + deliveryFee - promoDiscount;
  
  // Calculate wallet usage (partial payment allowed per Q9)
  const walletUsed = Math.min(walletBalance, grossTotal);
  const cardCharge = grossTotal - walletUsed;

  return {
    subtotal,
    deliveryFee,
    discount: promoDiscount,
    walletUsed,
    cardCharge,
    total: grossTotal,
  };
};

// ============================================
// EXPORTS
// ============================================

export default {
  // Customer management
  createOrGetCustomer,
  updateCustomer,
  deleteCustomer,
  
  // Payment methods
  attachPaymentMethod,
  setDefaultPaymentMethod,
  listPaymentMethods,
  detachPaymentMethod,
  
  // Payment intents
  createPaymentIntent,
  getPaymentIntent,
  confirmPaymentIntent,
  cancelPaymentIntent,
  
  // Refunds
  createRefund,
  getRefund,
  listRefunds,
  
  // Wallet
  processWalletTopUp,
  
  // Webhooks
  verifyWebhookSignature,
  handleWebhookEvent,
  
  // Utilities
  dollarsToCents,
  centsToDollars,
  calculateOrderTotal,
};
