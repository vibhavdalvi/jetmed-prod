import mongoose, { Schema } from 'mongoose';

const activityLogSchema = new Schema(
  {
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, index: true },
    userId: { type: String, index: true },
    role: { type: String, index: true },
    metadata: { type: Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

activityLogSchema.index({ createdAt: -1 });

export const ActivityLog =
  (mongoose.models.ActivityLog as mongoose.Model<Record<string, unknown>>) ||
  mongoose.model('ActivityLog', activityLogSchema);
