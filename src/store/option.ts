import { getRedisClient, type RedisLike } from "./redis.js";

export interface Option {
  id: string;
  poll_id: string;
  text: string;
  position: number;
}

const OptionKeyPrefix = "opt:";
const PollIndexPrefix = "opt:poll:";

export class OptionStore {
  private redis: RedisLike | null;

  constructor(redis?: RedisLike | null) {
    this.redis = redis !== undefined ? redis : getRedisClient();
  }

  private pk(id: string): string {
    return OptionKeyPrefix + id;
  }

  private ik(pollId: string): string {
    return PollIndexPrefix + pollId;
  }

  async create(option: Option): Promise<Option> {
    if (this.redis) {
      await this.redis.set(this.pk(option.id), JSON.stringify(option));
      await this.redis.sadd(this.ik(option.poll_id), option.id);
    }
    return option;
  }

  async getById(id: string): Promise<Option | null> {
    if (!this.redis) return null;
    const raw = await this.redis.get(this.pk(id));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Option;
    } catch {
      return null;
    }
  }

  async listByPoll(pollId: string): Promise<Option[]> {
    if (!this.redis) return [];
    const ids = await this.redis.smembers(this.ik(pollId));
    const options: Option[] = [];
    for (const id of ids) {
      const raw = await this.redis.get(this.pk(id));
      if (raw) {
        try {
          options.push(JSON.parse(raw) as Option);
        } catch {
          // skip corrupt entries
        }
      }
    }
    options.sort((a, b) => a.position - b.position);
    return options;
  }

  async deleteByPoll(pollId: string): Promise<boolean> {
    if (!this.redis) return false;
    const ids = await this.redis.smembers(this.ik(pollId));
    for (const id of ids) {
      await this.redis.del(this.pk(id));
    }
    await this.redis.del(this.ik(pollId));
    return true;
  }
}