import mongoose, { Schema, type Model } from 'mongoose';
import { PrescriptionStatus } from '../types/index.js';
import { addApiJson, uuidId } from '../utils/mongoSchema.js';

const prescriptionSchema = new Schema(
  {
    _id: { ...uuidId },
    userId: { type: String, required: true, index: true },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    fileType: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(PrescriptionStatus),
      default: PrescriptionStatus.PENDING,
    },
    validityDate: Date,
    issuedDate: Date,
    doctorName: String,
    hospitalName: String,
    uploadedAt: { type: Date, default: () => new Date() },
    verifiedBy: { type: String, ref: 'User' },
    verifiedAt: Date,
    rejectionReason: String,
    usedInOrderId: { type: String, ref: 'Order' },
  },
  { timestamps: true }
);

prescriptionSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

addApiJson(prescriptionSchema);

const Prescription =
  (mongoose.models.Prescription as Model<unknown>) ||
  mongoose.model('Prescription', prescriptionSchema);
export default Prescription;
