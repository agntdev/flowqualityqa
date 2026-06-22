import { getRedisClient, type RedisLike } from "./redis.js";

export interface Vote {
  id: string;
  poll_id: string;
  user_id: number;
  option_id: string;
  created_at: string;
}

const VoteKeyPrefix = "vote:";
const UserPollPrefix = "vote:up:";
const PollIndexPrefix = "vote:poll:";

export class VoteStore {
  private redis: RedisLike | null;

  constructor(redis?: RedisLike | null) {
    this.redis = redis !== undefined ? redis : getRedisClient();
  }

  private pk(id: string): string {
    return VoteKeyPrefix + id;
  }

  private uk(pollId: string, userId: number): string {
    return UserPollPrefix + pollId + ":" + String(userId);
  }

  private ik(pollId: string): string {
    return PollIndexPrefix + pollId;
  }

  async hasUserVoted(pollId: string, userId: number): Promise<boolean> {
    if (!this.redis) return false;
    const key = this.uk(pollId, userId);
    const raw = await this.redis.get(key);
    return raw !== null;
  }

  async getVoteByUserAndPoll(
    pollId: string,
    userId: number,
  ): Promise<Vote | null> {
    if (!this.redis) return null;
    const voteId = await this.redis.get(this.uk(pollId, userId));
    if (!voteId) return null;
    const raw = await this.redis.get(this.pk(voteId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Vote;
    } catch {
      return null;
    }
  }

  async create(vote: Vote): Promise<Vote | null> {
    if (!this.redis) return vote;

    const uk = this.uk(vote.poll_id, vote.user_id);
    const exists = await this.redis.get(uk);
    if (exists !== null) return null;

    await this.redis.set(this.pk(vote.id), JSON.stringify(vote));
    await this.redis.set(uk, vote.id);
    await this.redis.sadd(this.ik(vote.poll_id), vote.id);

    return vote;
  }

  async listByPoll(pollId: string): Promise<Vote[]> {
    if (!this.redis) return [];
    const ids = await this.redis.smembers(this.ik(pollId));
    const votes: Vote[] = [];
    for (const id of ids) {
      const raw = await this.redis.get(this.pk(id));
      if (raw) {
        try {
          votes.push(JSON.parse(raw) as Vote);
        } catch {
          // skip corrupt entries
        }
      }
    }
    return votes;
  }

  async countByOption(pollId: string, optionId: string): Promise<number> {
    if (!this.redis) return 0;
    const votes = await this.listByPoll(pollId);
    return votes.filter((v) => v.option_id === optionId).length;
  }

  async deleteByPoll(pollId: string): Promise<boolean> {
    if (!this.redis) return false;
    const ids = await this.redis.smembers(this.ik(pollId));
    for (const id of ids) {
      const raw = await this.redis.get(this.pk(id));
      if (raw) {
        try {
          const vote = JSON.parse(raw) as Vote;
          await this.redis.del(this.uk(vote.poll_id, vote.user_id));
        } catch {
          // skip corrupt
        }
      }
      await this.redis.del(this.pk(id));
    }
    await this.redis.del(this.ik(pollId));
    return true;
  }
}
