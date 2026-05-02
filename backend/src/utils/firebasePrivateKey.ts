/**
 * Normalize FIREBASE_PRIVATE_KEY from env (.env, Railway, Docker).
 * Handles:
 * - JSON-style `\n` escape sequences (recommended for single-line Railway vars)
 * - Real line breaks (multiline .env or quoted blocks)
 * - Wrapping quotes from bad pastes
 * - CRLF / lone CR
 */
export function normalizeFirebasePrivateKey(raw: string | undefined): string {
  if (!raw) return '';

  let k = raw.trim();

  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim();
  }

  k = k.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  k = k.replace(/\\n/g, '\n');

  return k.trim();
}

/** True if the string looks like a PEM PKCS#8 private key after normalization */
export function looksLikeFirebasePem(key: string): boolean {
  return (
    key.includes('BEGIN PRIVATE KEY') &&
    key.includes('END PRIVATE KEY') &&
    key.length > 80
  );
}
