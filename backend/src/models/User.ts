import bcrypt from 'bcryptjs';
import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';
import { UserRole } from '../types/index.js';
import { addApiJson, uuidId } from '../utils/mongoSchema.js';

const userSchema = new Schema(
  {
    _id: { ...uuidId },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    phone: { type: String, unique: true, sparse: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.CUSTOMER },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
  },
  { timestamps: true }
);

userSchema.virtual('profile', {
  ref: 'UserProfile',
  localField: '_id',
  foreignField: 'userId',
  justOne: true,
});
userSchema.virtual('medicalInfo', {
  ref: 'UserMedicalInfo',
  localField: '_id',
  foreignField: 'userId',
  justOne: true,
});
userSchema.virtual('wallet', {
  ref: 'Wallet',
  localField: '_id',
  foreignField: 'userId',
  justOne: true,
});

addApiJson(userSchema);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  if (typeof this.password === 'string' && /^\$2[aby]\$/.test(this.password)) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password as string);
};

type UserDoc = InferSchemaType<typeof userSchema> & {
  _id: string;
  comparePassword: (c: string) => Promise<boolean>;
};

const User: Model<UserDoc> = mongoose.models.User || mongoose.model<UserDoc>('User', userSchema);
export default User;
