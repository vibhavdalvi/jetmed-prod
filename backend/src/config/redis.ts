import { createClient } from 'redis';
import config from './index.js';

type RedisCli = ReturnType<typeof createClient>;
let redisClient: RedisCli | undefined;

/** True when REDIS_HOST is set (we attempt a connection). */
export const isRedisConfigured = (): boolean => Boolean(config.redis.host);

export const connectRedis = async (): Promise<void> => {
  if (!config.redis.host) {
    // Optional service: no startup attempt, no log noise (set REDIS_VERBOSE=true to log skip)
    if (process.env.REDIS_VERBOSE === 'true') {
      console.log('Redis skipped (not configured).');
    }
    return;
  }

  let client: RedisCli | undefined;
  try {
    client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
        reconnectStrategy: (retries: number) => {
          if (retries > 8) return false;
          return Math.min(retries * 150, 3000);
        },
      },
      password: config.redis.password,
    });

    client.on('error', (err: Error) => {
      if (process.env.REDIS_VERBOSE === 'true') {
        console.error('Redis Client Error:', err.message);
      }
    });

    await client.connect();
    redisClient = client;
    console.log('✅ Redis connected successfully');
  } catch (error: unknown) {
    if (client) {
      try {
        await client.quit();
      } catch {
        /* ignore */
      }
    }
    redisClient = undefined;
    if (process.env.REDIS_VERBOSE === 'true') {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`Redis unavailable (${msg}); continuing without cache`);
    }
  }
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
