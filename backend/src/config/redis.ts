import { createClient } from 'redis';
import config from './index.js';

type RedisCli = ReturnType<typeof createClient>;
let redisClient: RedisCli | undefined;

const REDIS_CONNECT_RETRIES = Number(process.env.REDIS_CONNECT_RETRIES || '15');
const REDIS_CONNECT_DELAY_MS = Number(process.env.REDIS_CONNECT_DELAY_MS || '1000');

/** True when REDIS_HOST is set (we attempt a connection). */
export const isRedisConfigured = (): boolean => Boolean(config.redis.host);

export const connectRedis = async (): Promise<void> => {
  if (!config.redis.host) {
    if (process.env.REDIS_VERBOSE === 'true') {
      console.log('Redis skipped (REDIS_DISABLED or no host in production).');
    }
    return;
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= REDIS_CONNECT_RETRIES; attempt++) {
    let client: RedisCli | undefined;
    try {
      client = createClient({
        socket: {
          host: config.redis.host,
          port: config.redis.port,
          reconnectStrategy: (retries: number) => {
            if (retries > 10) return false;
            return Math.min(retries * 200, 4000);
          },
        },
        password: config.redis.password,
      });

      client.on('error', (err: Error) => {
        if (process.env.REDIS_VERBOSE === 'true') {
          console.error('Redis client error:', err.message);
        }
      });

      await client.connect();
      redisClient = client;
      console.log(
        `✅ Redis connected (${config.redis.host}:${config.redis.port}) — refresh tokens & login lockout cache active`
      );
      return;
    } catch (error) {
      lastError = error;
      if (client) {
        try {
          await client.quit();
        } catch {
          /* ignore */
        }
      }
      redisClient = undefined;

      const msg = error instanceof Error ? error.message : String(error);
      const hint =
        process.env.NODE_ENV !== 'production'
          ? ' Start Redis: brew services start redis   or   docker run -p 6379:6379 redis:7-alpine'
          : ' Set REDIS_URL or REDIS_HOST to your managed Redis hostname.';

      if (attempt < REDIS_CONNECT_RETRIES) {
        console.warn(
          `⏳ Redis connect attempt ${attempt}/${REDIS_CONNECT_RETRIES} failed (${msg}). Retrying in ${REDIS_CONNECT_DELAY_MS}ms…${hint}`
        );
        await new Promise((r) => setTimeout(r, REDIS_CONNECT_DELAY_MS));
      }
    }
  }

  const finalMsg = lastError instanceof Error ? lastError.message : String(lastError);
  console.warn(
    `\n⚠️  Redis unavailable after ${REDIS_CONNECT_RETRIES} attempts (${finalMsg}). API runs without cache:` +
      ' refresh-token rotation and login lockout counters may not behave as intended.\n'
  );
};

export const getRedisClient = (): RedisCli | undefined => redisClient;

export const cacheGet = async (key: string): Promise<string | null> => {
  if (!redisClient?.isOpen) return null;
  try {
    return await redisClient.get(key);
  } catch (error) {
    console.error('Redis GET error:', error);
    return null;
  }
};

export const cacheSet = async (
  key: string,
  value: string,
  expirationSeconds?: number
): Promise<void> => {
  if (!redisClient?.isOpen) return;
  try {
    if (expirationSeconds) {
      await redisClient.setEx(key, expirationSeconds, value);
    } else {
      await redisClient.set(key, value);
    }
  } catch (error) {
    console.error('Redis SET error:', error);
  }
};

export const cacheDelete = async (key: string): Promise<void> => {
  if (!redisClient?.isOpen) return;
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error('Redis DEL error:', error);
  }
};

export const cacheDeletePattern = async (pattern: string): Promise<void> => {
  if (!redisClient?.isOpen) return;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (error) {
    console.error('Redis DEL pattern error:', error);
  }
};
