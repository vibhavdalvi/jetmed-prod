import type { Request } from 'express';
import mongoose from 'mongoose';
import { ActivityLog } from '../mongo/activityLog.model.js';

export type RecordActivityInput = {
  action: string;
  entityType: string;
  entityId?: string;
  userId?: string;
  role?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
};

export function requestAuditContext(req: Pick<Request, 'ip' | 'get' | 'socket'>): {
  ip?: string;
  userAgent?: string;
} {
  const rawIp = req.ip || req.socket?.remoteAddress;
  const ua = req.get('user-agent');
  return {
    ip: rawIp || undefined,
    userAgent: typeof ua === 'string' ? ua.slice(0, 500) : undefined,
  };
}

/**
 * Append-only audit trail in MongoDB. Never throws; failures are logged only.
 */
export async function recordActivity(input: RecordActivityInput): Promise<void> {
  if (mongoose.connection.readyState !== 1) return;
  try {
    await ActivityLog.create({
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      userId: input.userId,
      role: input.role,
      metadata: input.metadata,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  } catch (err) {
    console.error('[activityLog] persist failed:', err);
  }
}
