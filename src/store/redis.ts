import { createRequire } from "node:module";

export interface RedisMulti {
  get(key: string): RedisMulti;
  set(key: string, value: string): RedisMulti;
  del(key: string): RedisMulti;
  sadd(key: string, ...members: string[]): RedisMulti;
  srem(key: string, ...members: string[]): RedisMulti;
  exec(): Promise<Array<[Error | null, unknown]>>;
}

export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
  sadd(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  srem(key: string, ...members: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  multi(): RedisMulti;
}

let cached: RedisLike | null | undefined;

export function getRedisClient(): RedisLike | null {
  if (cached !== undefined) return cached;

  const url = process.env.REDIS_URL;
  if (!url) {
    cached = null;
    return null;
  }

  try {
    const require = createRequire(import.meta.url);
    const ioredis: Record<string, unknown> = require("ioredis");
    const Redis = (ioredis.default ?? ioredis.Redis ?? ioredis) as new (
      url: string,
      opts: Record<string, unknown>,
    ) => RedisLike;
    cached = new Redis(url, { maxRetriesPerRequest: null, lazyConnect: false });
    return cached;
  } catch {
    cached = null;
    return null;
  }
}