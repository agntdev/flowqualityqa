import type { RedisLike, RedisMulti } from "./redis.js";

export class InMemoryRedis implements RedisLike {
  private data = new Map<string, string>();
  private sets = new Map<string, Set<string>>();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<"OK"> {
    this.data.set(key, value);
    return "OK";
  }

  async del(key: string): Promise<number> {
    return this.data.delete(key) ? 1 : 0;
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    let set = this.sets.get(key);
    if (!set) {
      set = new Set<string>();
      this.sets.set(key, set);
    }
    let added = 0;
    for (const m of members) {
      if (!set!.has(m)) {
        set!.add(m);
        added++;
      }
    }
    return added;
  }

  async smembers(key: string): Promise<string[]> {
    const set = this.sets.get(key);
    return set ? [...set] : [];
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key);
    if (!set) return 0;
    let removed = 0;
    for (const m of members) {
      if (set.delete(m)) removed++;
    }
    return removed;
  }

  async keys(pattern: string): Promise<string[]> {
    const re = new RegExp(
      "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
    );
    return [...this.data.keys()].filter((k) => re.test(k));
  }

  clear(): void {
    this.data.clear();
    this.sets.clear();
  }

  multi(): RedisMulti {
    const cmds: Array<{
      op: string;
      key: string;
      args: string[];
      members?: string[];
    }> = [];

    const chain: RedisMulti = {
      get: (key: string) => {
        cmds.push({ op: "get", key, args: [] });
        return chain;
      },
      set: (key: string, value: string) => {
        cmds.push({ op: "set", key, args: [value] });
        return chain;
      },
      setnx: (key: string, value: string) => {
        cmds.push({ op: "setnx", key, args: [value] });
        return chain;
      },
      del: (key: string) => {
        cmds.push({ op: "del", key, args: [] });
        return chain;
      },
      sadd: (key: string, ...members: string[]) => {
        cmds.push({ op: "sadd", key, args: [], members });
        return chain;
      },
      srem: (key: string, ...members: string[]) => {
        cmds.push({ op: "srem", key, args: [], members });
        return chain;
      },
      exec: async () => {
        const results: Array<[null, unknown]> = [];
        for (const cmd of cmds) {
          switch (cmd.op) {
            case "get":
              results.push([null, await this.get(cmd.key)]);
              break;
            case "set":
              results.push([null, await this.set(cmd.key, cmd.args[0] ?? "")]);
              break;
            case "setnx": {
              const existing = await this.get(cmd.key);
              if (existing === null) {
                await this.set(cmd.key, cmd.args[0] ?? "");
                results.push([null, 1]);
              } else {
                results.push([null, 0]);
              }
              break;
            }
            case "del":
              results.push([null, await this.del(cmd.key)]);
              break;
            case "sadd":
              results.push([null, await this.sadd(cmd.key, ...(cmd.members ?? []))]);
              break;
            case "srem":
              results.push([null, await this.srem(cmd.key, ...(cmd.members ?? []))]);
              break;
            default:
              results.push([null, null]);
          }
        }
        return results;
      },
    };

    return chain;
  }
}