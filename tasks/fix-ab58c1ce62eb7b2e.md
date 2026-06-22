# fix-ab58c1ce62eb7b2e — E5T2 duplicates E2T1's vote handler, creating double-vote-recording in isolated Redis key spaces

**Weight:** 0.0000 (share of project budget)
**Reward:** 0 FQABOT

`src/handlers/E5T2.ts` handles the exact same `callback_query:data` with `vote:opt:` prefix as `src/handlers/E2T1.ts`. Both fire for every vote callback. E5T2 uses `voteStore.upsert()` which writes to `vote:txup:*` keys, while E2T1 uses `voteStore.update()` which writes to `vote:up:*` keys — two **isolated Redis key spaces**.

Consequences:
- Every vote is recorded twice (once per handler, in separate Redis key spaces)
- `hasUserVoted()` and `getVoteByUserAndPoll()` use the `vote:up:*` keyspace and cannot see votes stored by `upsert()`
- The transactional integrity of `upsert()` only applies to its own isolated keyspace
- The "duplicate vote overwrite" contract is violated: two different vote IDs exist for the same user/poll

E5T2 depends on E2T1 (per the task spec) and was meant to enhance it with upsert semantics. Instead it created a parallel handler. It should have replaced/edited E2T1's vote recording logic to use upsert in the shared `vote:up:*` keyspace, or E2T1 should be retired in favor of E5T2.

## Dialog tests

This is a FIX task: the behavior it repairs is already covered by an existing spec under `tests/specs/`. Fix the code to make that existing spec pass — do NOT author a new `tests/specs/fix-ab58c1ce62eb7b2e.json` (a duplicate spec for the same behavior makes the tests-gate count it twice and it can never go green). Add a new spec file ONLY if you are introducing genuinely new user-facing behavior that no existing spec covers; if so, name it `tests/specs/fix-ab58c1ce62eb7b2e.json` (and any new command `tests/commands/fix-ab58c1ce62eb7b2e.json`).


## Handler module

This is a FIX task. Find the EXISTING handler under `src/handlers/` that implements the affected command/behavior and EDIT it in place. Do NOT create a new `src/handlers/fix-ab58c1ce62eb7b2e.ts` — a second `Composer` binding the same command conflicts with the original and breaks the bot. Create a new handler file ONLY if the affected command does not exist anywhere yet (then name it `src/handlers/fix-ab58c1ce62eb7b2e.ts` and default-export a grammY `Composer`; `buildBot()` auto-loads it). NEVER edit `src/bot.ts`; the global error boundary + unknown-command fallback already live in `buildBot()`.


## Implementation contract

Ship a COMPLETE, working implementation — not a stub. A task is INCOMPLETE (and will be rejected) even if it compiles and the dialog tests pass when it does any of these:
- **Stubbed code:** empty bodies, `TODO`/`FIXME`, commented-out logic, or `throw new Error("not implemented")`.
- **Fabricated data:** `Math.random()`, hardcoded sample arrays, or canned responses standing in for real computed or fetched values.
- **No in-memory data store:** a `Map`/array/module-level variable used as a database is a defect. Anything that must survive a restart (records, subscriptions, balances, schedules, settings) MUST use the toolkit's persistent storage (Redis-backed), not process memory. (The toolkit's auto-selected session storage is only for ephemeral conversation state.)
- **Broken integrations:** call external APIs against their real contract — correct endpoints, ids and params (e.g. a coin *id* like `the-open-network`, not a ticker like `TON`) — with credentials read from env. Do not invent endpoints or fake responses.
- **Dead code:** the feature's command/handler must be registered via its default-exported `Composer` in `src/handlers/<slug>.ts` (auto-loaded) and reachable from the bot's command surface.
If the spec is genuinely under-specified, implement the smallest REAL slice you can verify and note the gap — never fake behavior to make the PR look complete.
