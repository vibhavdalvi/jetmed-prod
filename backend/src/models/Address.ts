import mongoose, { Schema, type Model } from 'mongoose';
import { addApiJson, uuidId } from '../utils/mongoSchema.js';

const addressSchema = new Schema(
  {
    _id: { ...uuidId },
    userId: { type: String, required: true, index: true },
    label: { type: String, default: 'Home' },
    streetAddress: { type: String, required: true },
    apartment: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, default: 'United States' },
    latitude: Number,
    longitude: Number,
    deliveryInstructions: String,
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

addApiJson(addressSchema);

const Address =
  (mongoose.models.Address as Model<unknown>) || mongoose.model('Address', addressSchema);
export default Address;
