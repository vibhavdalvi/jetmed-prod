import { rxInsensitive } from './mongoSchema.js';

/** Mongo filter helpers (replace Sequelize `Op` usage). */
export const M = {
  in: <T>(arr: T[]) => ({ $in: arr }),
  nin: <T>(arr: T[]) => ({ $nin: arr }),
  between: (a: Date, b: Date) => ({ $gte: a, $lte: b }),
  gte: <T>(v: T) => ({ $gte: v }),
  lte: <T>(v: T) => ({ $lte: v }),
  gt: <T>(v: T) => ({ $gt: v }),
  lt: <T>(v: T) => ({ $lt: v }),
  ne: <T>(v: T) => ({ $ne: v }),
  or: (conds: Record<string, unknown>[]) => ({ $or: conds }),
  and: (conds: Record<string, unknown>[]) => ({ $and: conds }),
  iLike: (s: string) => rxInsensitive(s),
  startsWith: (s: string) => new RegExp(`^${escapeRx(s)}`, 'i'),
};

function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
