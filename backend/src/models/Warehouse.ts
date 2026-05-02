import mongoose, { Schema, type Model } from 'mongoose';
import { addApiJson, uuidId } from '../utils/mongoSchema.js';

const warehouseSchema = new Schema(
  {
    _id: { ...uuidId },
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    deliveryRadius: { type: Number, default: 25 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

addApiJson(warehouseSchema);

const inventorySchema = new Schema(
  {
    _id: { ...uuidId },
    medicineId: { type: String, required: true, index: true },
    dosageOptionId: { type: String, required: true },
    warehouseId: { type: String, required: true, index: true },
    quantity: { type: Number, required: true, default: 0, min: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 },
    reorderLevel: { type: Number, default: 50 },
    reorderQuantity: { type: Number, default: 200 },
    batchNumber: { type: String, required: true },
    expiryDate: { type: Date, required: true },
    costPrice: { type: Number, required: true },
  },
  { timestamps: true }
);

inventorySchema.virtual('medicine', {
  ref: 'Medicine',
  localField: 'medicineId',
  foreignField: '_id',
  justOne: true,
});
inventorySchema.virtual('warehouse', {
  ref: 'Warehouse',
  localField: 'warehouseId',
  foreignField: '_id',
  justOne: true,
});

addApiJson(inventorySchema);

const Warehouse =
  (mongoose.models.Warehouse as Model<unknown>) || mongoose.model('Warehouse', warehouseSchema);
const Inventory =
  (mongoose.models.Inventory as Model<unknown>) || mongoose.model('Inventory', inventorySchema);

export { Warehouse, Inventory };
