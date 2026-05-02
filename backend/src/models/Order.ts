// @ts-nocheck
import mongoose, { Schema, type Model } from 'mongoose';
import { OrderStatus, DeliveryType, UrgencyLevel } from '../types/index.js';
import { addApiJson, uuidId } from '../utils/mongoSchema.js';

const orderItemSchema = new Schema(
  {
    _id: { ...uuidId },
    orderId: { type: String, required: true, index: true },
    medicineId: { type: String, required: true, ref: 'Medicine' },
    dosageOptionId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    prescriptionRequired: { type: Boolean, default: false },
  },
  { timestamps: false }
);

addApiJson(orderItemSchema);

orderItemSchema.virtual('medicine', {
  ref: 'Medicine',
  localField: 'medicineId',
  foreignField: '_id',
  justOne: true,
});

const orderSchema = new Schema(
  {
    _id: { ...uuidId },
    orderNumber: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true, ref: 'User' },
    warehouseId: { type: String, required: true, ref: 'Warehouse' },
    addressId: { type: String, required: true, ref: 'Address' },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PLACED,
    },
    items: { type: [Schema.Types.Mixed], default: [] },
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    tipAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    deliveryType: {
      type: String,
      enum: Object.values(DeliveryType),
      default: DeliveryType.STANDARD,
    },
    scheduledDate: Date,
    scheduledTimeSlot: String,
    urgencyLevel: {
      type: String,
      enum: Object.values(UrgencyLevel),
      default: UrgencyLevel.ROUTINE,
    },
    prescriptionRequired: { type: Boolean, default: false },
    prescriptionIds: { type: [String], default: [] },
    symptomsDescription: String,
    guidedResponses: Schema.Types.Mixed,
    pharmacistNotes: String,
    reviewedBy: { type: String, ref: 'User' },
    reviewedAt: Date,
    packedBy: { type: String, ref: 'User' },
    packedAt: Date,
    deliveryPartnerId: { type: String, ref: 'User' },
    deliveryStartedAt: Date,
    deliveredAt: Date,
    deliveryOTP: String,
    deliveryProofImage: String,
    deliveryNotes: String,
    cancellationReason: String,
    cancelledBy: String,
    cancelledAt: Date,
    promoCodeId: String,
    deliveryLocation: Schema.Types.Mixed,
    deliveryLocationUpdatedAt: Date,
    deliverySignature: String,
    deliveryPhotoProof: String,
    deliveryIssue: Schema.Types.Mixed,
    packageWeight: Number,
    packageDimensions: Schema.Types.Mixed,
    packingNotes: String,
    callLogs: { type: [Schema.Types.Mixed], default: [] },
    chatHistory: { type: [Schema.Types.Mixed], default: [] },
  },
  { timestamps: true }
);

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `JM-${timestamp}-${random}`;
}

orderSchema.pre('validate', function (next) {
  const doc = this as mongoose.HydratedDocument<unknown> & {
    orderNumber?: string;
    prescriptionRequired?: boolean;
    deliveryOTP?: string;
  };
  if (!doc.orderNumber) {
    doc.orderNumber = generateOrderNumber();
  }
  if (doc.prescriptionRequired && !doc.deliveryOTP) {
    doc.deliveryOTP = generateOTP();
  }
  next();
});

orderSchema.statics.generateOTP = generateOTP;
orderSchema.statics.generateOrderNumber = generateOrderNumber;

orderSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});
orderSchema.virtual('warehouse', {
  ref: 'Warehouse',
  localField: 'warehouseId',
  foreignField: '_id',
  justOne: true,
});
orderSchema.virtual('deliveryAddress', {
  ref: 'Address',
  localField: 'addressId',
  foreignField: '_id',
  justOne: true,
});
orderSchema.virtual('reviewer', {
  ref: 'User',
  localField: 'reviewedBy',
  foreignField: '_id',
  justOne: true,
});
orderSchema.virtual('deliveryPartner', {
  ref: 'User',
  localField: 'deliveryPartnerId',
  foreignField: '_id',
  justOne: true,
});
orderSchema.virtual('payments', {
  ref: 'Payment',
  localField: '_id',
  foreignField: 'orderId',
});
orderSchema.virtual('orderItems', {
  ref: 'OrderItem',
  localField: '_id',
  foreignField: 'orderId',
});

addApiJson(orderSchema);

const Order =
  (mongoose.models.Order as Model<unknown>) || mongoose.model('Order', orderSchema);
const OrderItem =
  (mongoose.models.OrderItem as Model<unknown>) || mongoose.model('OrderItem', orderItemSchema);

export { Order, OrderItem };
