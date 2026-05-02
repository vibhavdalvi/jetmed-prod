// ═══════════════════════════════════════════════════════════════════════════════
// JetMed - Stripe Payment Service (Frontend)
// ═══════════════════════════════════════════════════════════════════════════════

import { loadStripe, Stripe, StripeElements, PaymentIntent } from '@stripe/stripe-js';
import api from './api';

// Initialize Stripe
let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      console.error('Stripe publishable key not configured');
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT INTENT OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreatePaymentIntentRequest {
  orderId: string;
  amount: number;
  currency?: string;
  paymentMethodId?: string;
  useWallet?: boolean;
  walletAmount?: number;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  status: string;
}

/**
 * Create a payment intent for an order
 */
export const createPaymentIntent = async (
  data: CreatePaymentIntentRequest
): Promise<PaymentIntentResponse> => {
  const response = await api.post('/payments/create-intent', data);
  return response.data.data;
};

/**
 * Confirm a payment with the payment method
 */
export const confirmPayment = async (
  clientSecret: string,
  elements: StripeElements
): Promise<{ paymentIntent?: PaymentIntent; error?: Error }> => {
  const stripe = await getStripe();
  if (!stripe) {
    return { error: new Error('Stripe not initialized') };
  }

  const { error, paymentIntent } = await stripe.confirmPayment({
    elements,
    confirmParams: {
      return_url: `${window.location.origin}/order/confirmation`,
    },
    redirect: 'if_required',
  });

  if (error) {
    return { error: error as unknown as Error };
  }

  return { paymentIntent };
};

/**
 * Confirm card payment directly
 */
export const confirmCardPayment = async (
  clientSecret: string,
  paymentMethodId: string
): Promise<{ paymentIntent?: PaymentIntent; error?: Error }> => {
  const stripe = await getStripe();
  if (!stripe) {
    return { error: new Error('Stripe not initialized') };
  }

  const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
    payment_method: paymentMethodId,
  });

  if (error) {
    return { error: error as unknown as Error };
  }

  return { paymentIntent };
};

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT METHODS
// ═══════════════════════════════════════════════════════════════════════════════

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account';
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  isDefault: boolean;
}

/**
 * Get saved payment methods
 */
export const getPaymentMethods = async (): Promise<PaymentMethod[]> => {
  const response = await api.get('/payments/methods');
  return response.data.data.paymentMethods;
};

/**
 * Add a new payment method
 */
export const addPaymentMethod = async (paymentMethodId: string): Promise<PaymentMethod> => {
  const response = await api.post('/payments/methods', { paymentMethodId });
  return response.data.data.paymentMethod;
};

/**
 * Remove a payment method
 */
export const removePaymentMethod = async (paymentMethodId: string): Promise<void> => {
  await api.delete(`/payments/methods/${paymentMethodId}`);
};

/**
 * Set default payment method
 */
export const setDefaultPaymentMethod = async (paymentMethodId: string): Promise<void> => {
  await api.put(`/payments/methods/${paymentMethodId}/default`);
};

// ═══════════════════════════════════════════════════════════════════════════════
// WALLET OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface WalletBalance {
  balance: number;
  currency: string;
  lastUpdated: string;
}

export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit' | 'refund';
  amount: number;
  description: string;
  createdAt: string;
  orderId?: string;
}

/**
 * Get wallet balance
 */
export const getWalletBalance = async (): Promise<WalletBalance> => {
  const response = await api.get('/wallet/balance');
  return response.data.data;
};

/**
 * Top up wallet
 */
export const topUpWallet = async (
  amount: number,
  paymentMethodId: string
): Promise<{ success: boolean; newBalance: number }> => {
  const response = await api.post('/wallet/top-up', { amount, paymentMethodId });
  return response.data.data;
};

/**
 * Get wallet transactions
 */
export const getWalletTransactions = async (
  page: number = 1,
  limit: number = 20
): Promise<{ transactions: WalletTransaction[]; total: number }> => {
  const response = await api.get('/wallet/transactions', { params: { page, limit } });
  return response.data.data;
};

// ═══════════════════════════════════════════════════════════════════════════════
// REFUND OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface RefundRequest {
  orderId: string;
  reason: string;
  amount?: number; // For partial refunds
}

export interface RefundResponse {
  refundId: string;
  amount: number;
  status: string;
  walletCredit?: number;
}

/**
 * Request a refund
 */
export const requestRefund = async (data: RefundRequest): Promise<RefundResponse> => {
  const response = await api.post('/payments/refund', data);
  return response.data.data;
};

/**
 * Get refund status
 */
export const getRefundStatus = async (refundId: string): Promise<RefundResponse> => {
  const response = await api.get(`/payments/refund/${refundId}`);
  return response.data.data;
};

// ═══════════════════════════════════════════════════════════════════════════════
// STRIPE ELEMENTS HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export const stripeElementsOptions = {
  fonts: [
    {
      cssSrc: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap',
    },
  ],
  appearance: {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#2563eb', // JetMed blue
      colorBackground: '#ffffff',
      colorText: '#1f2937',
      colorDanger: '#ef4444',
      fontFamily: 'Inter, system-ui, sans-serif',
      spacingUnit: '4px',
      borderRadius: '8px',
    },
    rules: {
      '.Input': {
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      },
      '.Input:focus': {
        border: '1px solid #2563eb',
        boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)',
      },
      '.Label': {
        fontWeight: '500',
        fontSize: '14px',
        marginBottom: '8px',
      },
    },
  },
};

export const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#1f2937',
      fontFamily: 'Inter, system-ui, sans-serif',
      '::placeholder': {
        color: '#9ca3af',
      },
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444',
    },
  },
  hidePostalCode: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format amount for display
 */
export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
};

/**
 * Get card brand icon name
 */
export const getCardBrandIcon = (brand: string): string => {
  const brands: Record<string, string> = {
    visa: 'visa',
    mastercard: 'mastercard',
    amex: 'amex',
    discover: 'discover',
    diners: 'diners',
    jcb: 'jcb',
    unionpay: 'unionpay',
  };
  return brands[brand.toLowerCase()] || 'generic-card';
};

/**
 * Check if payment method is expiring soon
 */
export const isCardExpiringSoon = (expMonth: number, expYear: number): boolean => {
  const now = new Date();
  const expDate = new Date(expYear, expMonth - 1);
  const threeMonthsFromNow = new Date();
  threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
  return expDate <= threeMonthsFromNow && expDate >= now;
};

export default {
  getStripe,
  createPaymentIntent,
  confirmPayment,
  confirmCardPayment,
  getPaymentMethods,
  addPaymentMethod,
  removePaymentMethod,
  setDefaultPaymentMethod,
  getWalletBalance,
  topUpWallet,
  getWalletTransactions,
  requestRefund,
  getRefundStatus,
  formatCurrency,
};
