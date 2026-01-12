import Redis from 'ioredis';

let redis: Redis | null = null;

export const connectRedis = async (): Promise<Redis> => {
  if (redis) {
    return redis;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    reconnectOnError: (err) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    },
  });

  redis.on('connect', () => {
    console.log('✅ Redis connected');
  });

  redis.on('error', (err) => {
    console.error('❌ Redis error:', err);
  });

  redis.on('close', () => {
    console.log('⚠️ Redis connection closed');
  });

  return redis;
};

export const getRedis = (): Redis => {
  if (!redis) {
    throw new Error('Redis not connected. Call connectRedis() first.');
  }
  return redis;
};

// Redis utilities
export const redisUtils = {
  // Distributed lock
  acquireLock: async (key: string, value: string, ttlSeconds = 10): Promise<boolean> => {
    const client = getRedis();
    const result = await client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  },

  releaseLock: async (key: string): Promise<void> => {
    const client = getRedis();
    await client.del(key);
  },

  // Cache with TTL
  setCache: async (key: string, value: any, ttlSeconds = 300): Promise<void> => {
    const client = getRedis();
    await client.setex(key, ttlSeconds, JSON.stringify(value));
  },

  getCache: async <T>(key: string): Promise<T | null> => {
    const client = getRedis();
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  },

  // Session state
  setSessionState: async (sessionId: string, state: Record<string, any>): Promise<void> => {
    const client = getRedis();
    await client.hset(`session:${sessionId}`, state);
    await client.expire(`session:${sessionId}`, 14400); // 4 hours
  },

  getSessionState: async (sessionId: string): Promise<Record<string, string> | null> => {
    const client = getRedis();
    const state = await client.hgetall(`session:${sessionId}`);
    return Object.keys(state).length > 0 ? state : null;
  },

  // Pub/Sub
  publish: async (channel: string, message: any): Promise<void> => {
    const client = getRedis();
    await client.publish(channel, JSON.stringify(message));
  },

  // Delete key
  delete: async (key: string): Promise<void> => {
    const client = getRedis();
    await client.del(key);
  },
};

