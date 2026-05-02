import mongoose, { Schema, type Model } from 'mongoose';
import { Gender } from '../types/index.js';
import { addApiJson, uuidId } from '../utils/mongoSchema.js';

const userProfileSchema = new Schema(
  {
    _id: { ...uuidId },
    userId: { type: String, required: true, unique: true, index: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    displayName: String,
    avatar: String,
    dateOfBirth: Date,
    gender: { type: String, enum: [...Object.values(Gender)] },
    timezone: { type: String, default: 'America/New_York' },
    preferences: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

addApiJson(userProfileSchema);

const UserProfile =
  (mongoose.models.UserProfile as Model<unknown>) ||
  mongoose.model('UserProfile', userProfileSchema);
export default UserProfile;
