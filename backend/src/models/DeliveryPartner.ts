import mongoose, { Schema, type Model } from 'mongoose';
import { addApiJson, uuidId } from '../utils/mongoSchema.js';

const deliveryPartnerSchema = new Schema(
  {
    _id: { ...uuidId },
    userId: { type: String, required: true, unique: true },
    vehicleType: { type: String, required: true },
    vehicleNumber: { type: String, required: true },
    licenseNumber: { type: String, required: true },
    licenseExpiryDate: { type: Date, required: true },
    documentsVerified: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    currentLatitude: Number,
    currentLongitude: Number,
    totalDeliveries: { type: Number, default: 0 },
    rating: { type: Number, default: 5 },
    totalEarnings: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const deliveryEarningsSchema = new Schema(
  {
    _id: { ...uuidId },
    deliveryPartnerId: { type: String, required: true, index: true },
    orderId: { type: String, required: true },
    baseAmount: { type: Number, required: true },
    distanceBonus: { type: Number, default: 0 },
    timeBonus: { type: Number, default: 0 },
    surgeBonus: { type: Number, default: 0 },
    tipAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    isPaid: { type: Boolean, default: false },
    paidAt: Date,
    createdAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false }
);

deliveryPartnerSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

addApiJson(deliveryPartnerSchema);
addApiJson(deliveryEarningsSchema);

const DeliveryPartner =
  (mongoose.models.DeliveryPartner as Model<unknown>) ||
  mongoose.model('DeliveryPartner', deliveryPartnerSchema);
const DeliveryEarnings =
  (mongoose.models.DeliveryEarnings as Model<unknown>) ||
  mongoose.model('DeliveryEarnings', deliveryEarningsSchema);

export { DeliveryPartner, DeliveryEarnings };
