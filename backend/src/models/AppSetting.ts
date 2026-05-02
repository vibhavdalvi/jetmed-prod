import mongoose, { Schema, type Model } from 'mongoose';
import { addApiJson, uuidId } from '../utils/mongoSchema.js';

const appSettingSchema = new Schema(
  {
    _id: { ...uuidId },
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true, default: {} },
  },
  { timestamps: true }
);

addApiJson(appSettingSchema);

const AppSetting =
  (mongoose.models.AppSetting as Model<unknown>) ||
  mongoose.model('AppSetting', appSettingSchema);
export default AppSetting;
