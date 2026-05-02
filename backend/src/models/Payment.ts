import mongoose, { Schema, type Model } from 'mongoose';
import { PaymentMethod, PaymentStatus } from '../types/index.js';
import { addApiJson, uuidId } from '../utils/mongoSchema.js';

const paymentSchema = new Schema(
  {
    _id: { ...uuidId },
    orderId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    method: { type: String, enum: Object.values(PaymentMethod), required: true },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    stripePaymentIntentId: String,
    stripeChargeId: String,
    walletTransactionId: String,
    cardLast4: String,
    cardBrand: String,
    failureReason: String,
    refundedAmount: Number,
    refundReason: String,
    refundedAt: Date,
  },
  { timestamps: true }
);

const walletSchema = new Schema(
  {
    _id: { ...uuidId },
    userId: { type: String, required: true, unique: true },
    balance: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'USD' },
  },
  { timestamps: true }
);

walletSchema.virtual('transactions', {
  ref: 'WalletTransaction',
  localField: '_id',
  foreignField: 'walletId',
});

const walletTransactionSchema = new Schema(
  {
    _id: { ...uuidId },
    walletId: { type: String, required: true, index: true },
    type: { type: String, enum: ['credit', 'debit'], required: true },
    amount: { type: Number, required: true },
    description: { type: String, required: true },
    referenceType: String,
    referenceId: String,
    balanceAfter: { type: Number, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false }
);

paymentSchema.virtual('order', {
  ref: 'Order',
  localField: 'orderId',
  foreignField: '_id',
  justOne: true,
});

addApiJson(paymentSchema);
addApiJson(walletSchema);
addApiJson(walletTransactionSchema);

const Payment =
  (mongoose.models.Payment as Model<unknown>) || mongoose.model('Payment', paymentSchema);
const Wallet =
  (mongoose.models.Wallet as Model<unknown>) || mongoose.model('Wallet', walletSchema);
const WalletTransaction =
  (mongoose.models.WalletTransaction as Model<unknown>) ||
  mongoose.model('WalletTransaction', walletTransactionSchema);

export { Payment, Wallet, WalletTransaction };
