/**
 * Vercel production builds must set VITE_API_URL to the full Render (or other) API URL,
 * e.g. https://your-service.onrender.com/api/v1 — relative /api/v1 only works in local dev (Vite proxy).
 */
export function isProductionMissingRemoteApi(): boolean {
  if (!import.meta.env.PROD) return false;
  const v = import.meta.env.VITE_API_URL?.trim() ?? '';
  return !v.startsWith('https://');
}
