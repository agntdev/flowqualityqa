import { runSpecs } from "../src/toolkit/harness/run-specs.js";
import { readFile } from "node:fs/promises";

const specs = JSON.parse(await readFile("/workspace/repo/tests/specs/E6T7.json", "utf8"));
const mod = await import("/workspace/repo/dist/harness-entry.js");
const makeBot = mod.makeBot ?? mod.default;
const suite = await runSpecs(makeBot, specs);
for (const r of suite.results) {
  console.log(`${r.ok ? "✓" : "✗"} ${r.name}`);
  for (let i = 0; i < r.steps.length; i++) {
    const st = r.steps[i];
    if (!st.ok) {
      console.log(`  step ${i + 1}: FAIL`);
      for (const f of st.failures) console.log(`    ${f}`);
    }
    console.log("  captured:");
    for (const c of st.captured) {
      console.log(`    ${c.method} ${JSON.stringify(c.payload)}`);
    }
  }
}
