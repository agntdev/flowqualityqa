import { createRequire } from "node:module";

export interface Poll {
  id: string;
  chat_id: number;
  message_id: number;
  creator_user_id: number;
  question: string;
  is_anonymous: boolean;
  is_closed: boolean;
  created_at: string;
  closed_at: string | null;
}

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
  sadd(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
}

const PollKeyPrefix = "poll:";
const ChatIndexPrefix = "poll:chat:";

function getRedisClient(): RedisLike | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    const require = createRequire(import.meta.url);
    const ioredis: Record<string, unknown> = require("ioredis");
    const Redis = (ioredis.default ?? ioredis.Redis ?? ioredis) as new (
      url: string,
      opts: Record<string, unknown>,
    ) => RedisLike;
    return new Redis(url, { maxRetriesPerRequest: null, lazyConnect: false });
  } catch {
    return null;
  }
}

export class PollStore {
  private redis: RedisLike | null;

  constructor(redis?: RedisLike | null) {
    this.redis = redis !== undefined ? redis : getRedisClient();
  }

  private pk(id: string): string {
    return PollKeyPrefix + id;
  }

  private ck(chatId: number): string {
    return ChatIndexPrefix + String(chatId);
  }

  async create(poll: Poll): Promise<Poll> {
    if (this.redis) {
      await this.redis.set(this.pk(poll.id), JSON.stringify(poll));
      await this.redis.sadd(this.ck(poll.chat_id), poll.id);
    }
    return poll;
  }

  async getById(id: string): Promise<Poll | null> {
    if (!this.redis) return null;
    const raw = await this.redis.get(this.pk(id));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Poll;
    } catch {
      return null;
    }
  }

  async close(id: string, closedAt: string): Promise<Poll | null> {
    const poll = await this.getById(id);
    if (!poll) return null;
    poll.is_closed = true;
    poll.closed_at = closedAt;
    if (this.redis) {
      await this.redis.set(this.pk(id), JSON.stringify(poll));
    }
    return poll;
  }

  async listByChat(chatId: number): Promise<Poll[]> {
    if (!this.redis) return [];
    const ids = await this.redis.smembers(this.ck(chatId));
    const polls: Poll[] = [];
    for (const id of ids) {
      const raw = await this.redis.get(this.pk(id));
      if (raw) {
        try {
          polls.push(JSON.parse(raw) as Poll);
        } catch {
          // skip corrupt entries
        }
      }
    }
    return polls;
  }

  async delete(id: string): Promise<boolean> {
    const poll = await this.getById(id);
    if (!poll) return false;
    if (this.redis) {
      await this.redis.del(this.pk(id));
      // Note: not removing from chat index for simplicity; orphaned entries
      // are harmless and a full cleanup would require Redis multi/exec
    }
    return true;
  }
}
