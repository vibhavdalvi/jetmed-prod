import { randomUUID } from 'crypto';
import type { Schema } from 'mongoose';

/** UUID string primary keys (API-compatible with previous Sequelize models). */
export const uuidId = {
  type: String,
  default: () => randomUUID(),
};

export function addApiJson<T>(schema: Schema<T>): void {
  schema.set('toJSON', {
    virtuals: true,
    transform: (_doc: unknown, ret: Record<string, unknown>) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  });
  schema.set('toObject', { virtuals: true });
}

/** Case-insensitive substring match (replaces Sequelize Op.iLike `%x%`). */
export function rxInsensitive(contains: string): RegExp {
  return new RegExp(escapeRx(contains), 'i');
}

function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
