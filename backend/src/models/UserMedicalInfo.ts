import mongoose, { Schema, type Model } from 'mongoose';
import { addApiJson, uuidId } from '../utils/mongoSchema.js';

const userMedicalInfoSchema = new Schema(
  {
    _id: { ...uuidId },
    userId: { type: String, required: true, unique: true, index: true },
    allergies: { type: [String], default: [] },
    currentMedications: { type: [String], default: [] },
    chronicConditions: { type: [String], default: [] },
    bloodType: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    },
    emergencyContactName: String,
    emergencyContactPhone: String,
    insuranceProvider: String,
    insurancePolicyNumber: String,
    insuranceCardImage: String,
    governmentIdImage: String,
  },
  { timestamps: true }
);

addApiJson(userMedicalInfoSchema);

const UserMedicalInfo =
  (mongoose.models.UserMedicalInfo as Model<unknown>) ||
  mongoose.model('UserMedicalInfo', userMedicalInfoSchema);
export default UserMedicalInfo;
