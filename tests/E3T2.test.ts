import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildBot } from "../src/bot.js";
import { runSpecs, parseBotSpec } from "../src/toolkit/index.js";

describe("E3T2 Export CSV", () => {
  it("passes all E3T2 dialog specs", async () => {
    const raw = JSON.parse(
      readFileSync(new URL("./specs/E3T2.json", import.meta.url), "utf8"),
    ) as unknown[];
    const specs = raw.map(parseBotSpec);
    const suite = await runSpecs(() => buildBot("test-token"), specs);
    if (suite.failed > 0) {
      console.error(
        suite.results.flatMap((r) =>
          r.steps.filter((s) => !s.ok).flatMap((s) => s.failures),
        ),
      );
    }
    expect(suite.failed).toBe(0);
    expect(suite.passed).toBe(specs.length);
  });
});
