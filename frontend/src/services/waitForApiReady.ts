import { API_BASE_URL } from './api';

const LIVENESS_PATH = `${API_BASE_URL.replace(/\/$/, '')}/health`;
const POLL_MS = 280;
const MAX_WAIT_MS = 120_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function pollUntilLive(): Promise<void> {
  const started = Date.now();
  for (;;) {
    try {
      const res = await fetch(LIVENESS_PATH, { method: 'GET', credentials: 'omit' });
      if (res.ok) return;
    } catch {
      // ECONNREFUSED, DNS, etc. — keep polling until API listens (e.g. dev: concurrent startup).
    }
    if (Date.now() - started > MAX_WAIT_MS) {
      throw new Error(
        `Could not reach the API at ${LIVENESS_PATH} after ${MAX_WAIT_MS / 1000}s. Is the backend running and reachable?`
      );
    }
    await sleep(POLL_MS);
  }
}

let ready: Promise<void> | null = null;

/**
 * Resolves when the API responds OK to the versioned liveness endpoint.
 * Deduped so React StrictMode / double mount does not spawn parallel polls.
 */
export function waitForApiReady(): Promise<void> {
  if (!ready) {
    ready = pollUntilLive();
  }
  return ready;
}
