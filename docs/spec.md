## FlowQualityQABot — refined brief

Summary

FlowQualityQABot is a small-team Telegram bot that enables fast decision polls using only inline buttons (no slash commands as the normal UI). A creator uses an inline builder to compose a poll (question + 2–5 options), choose anonymous or named voting, and post the poll to the chat. Voters choose options using inline buttons; results show live totals. The creator and bot admins can close the poll and export a concise summary (CSV). /start and /help are present only as fallbacks.

Audience

- Small teams using Telegram group chats or 1:1 with the bot.
- Lightweight decision-making where quick inline voting and a simple export are required.

Core entities

- Poll
  - id (UUID)
  - chat_id (Telegram chat where the poll message lives)
  - message_id (Telegram message id of the posted poll)
  - creator_user_id
  - question (text)
  - is_anonymous (bool)
  - is_closed (bool)
  - created_at, closed_at
- Option
  - id (integer per poll)
  - poll_id
  - text
  - position (1..5)
- Vote
  - id
  - poll_id
  - user_id (Telegram user id)
  - option_id
  - created_at
- BotAdmins (configuration list of Telegram user ids, not a runtime table)

Integrations & notification targets

- No external integrations.
- Notifications are Telegram callback query answers and message edits in the same chat where the poll was posted.
- Export is delivered as a Telegram document (CSV) to the requesting user (creator or admin).

Interaction flows (complete, inline-button driven)

1) Entry point
   - When the bot is added to a chat OR a user opens a private chat and sends /start (fallback), the bot posts a persistent starter message in that chat (or when first interacted privately) with an inline keyboard: [Create poll]. This is the primary entry to creation; no slash commands are required.

2) Create poll (builder flow, in the same chat where Create poll was tapped)
   - User taps Create poll.
   - Bot starts a short sequential builder in that chat: prompts (text messages) are used to receive the question and option texts; all follow-up controls are inline buttons.
   - Step A: Bot asks: "Enter poll question" (user types free text). Empty questions are rejected.
   - Step B: Bot asks for the first option text. After each option entry the bot shows inline buttons: [Add option] (collect next option by typing), [Done] (finish building), [Toggle anonymous: ON/OFF], [Cancel].
   - Options are validated: at least 2 and at most 5 non-empty options. Empty option entries are rejected with a short message and re-prompt.
   - Duplicate option texts are allowed but discouraged; no automatic deduplication.
   - When the user taps Done and the option count is valid, bot shows a preview with inline buttons: [Post poll], [Edit options], [Toggle anonymous], [Cancel].
   - Posting creates a poll message in the same chat with inline voting buttons (one per option) plus a second-row keyboard with [Results], and — visible only to poll creator and configured bot admins — [Close poll], [Export].

Notes:
- Creation occurs in the chat where the user tapped Create poll. If a user wants to post in a group, they must tap Create poll from that group (the bot must be present in that group). This keeps sharing simple and reliable.
- The only typed inputs are the question and option texts; all control actions use inline buttons.

3) Voting
   - Voters tap an option button. The bot records the vote server-side.
   - Duplicate votes from the same user overwrite the prior vote (i.e., the latest selection counts). The voter receives an ephemeral callback notification "Vote registered" (or a short reason when disallowed).
   - If the poll is anonymous, the bot stores user ids internally (for preventing duplicate votes and for export integrity) but never exposes voter identities in any results or export.
   - For named polls, Results and Export include voter identity.

4) Results
   - Tapping [Results] returns a compact live summary: each option with count and percentage. For named polls, a short per-option list of voters (display name and user id) is included in the export; in the live Results view show the first N voters (configurable default N=10) and say "and X more".
   - The posted poll message is kept up-to-date: the bot will edit the poll message to reflect live counts when votes change (rate-limited to avoid exceeding Telegram API limits).

5) Close poll
   - The poll creator and any bot admin can tap [Close poll]. The bot sets is_closed=true, replaces voting buttons with a disabled state and a single [Results] button (and retains [Export] for permitted users). Further vote attempts receive a callback alert "Poll is closed".

6) Export
   - The poll creator and bot admins can tap [Export]. The bot composes a concise CSV and sends it as a Telegram document to the requesting user only.
   - CSV contents for named poll: question, option texts with counts, and per-option voter list (user id, display name, vote timestamp) — minimal columns to be compact.
   - CSV for anonymous poll: summary counts only (no voter columns).

Error handling & invalid callbacks

- Invalid callbackQuery (stale message, removed poll, malformed data): answerCallbackQuery with a short message: "Action no longer available" or specific reason.
- Empty inputs: builder rejects and re-prompts.
- Duplicate callbacks (race): operations are idempotent; use optimistic locking to avoid double counting; replyCallback informs the user.
- Closed polls: answerCallbackQuery "Poll is closed" and do not change data.

Persistence

- Local SQLite (file-based) database with migrations for small-team deployment. Schema includes Poll, Option, Vote tables and necessary indexes and uniqueness constraints (one Vote per poll_id+user_id). Use pragmas for WAL and reasonable busy timeout. SQLite is chosen for simplicity; the brief documents how to swap to Postgres later.
- Keep all historical data; support export at any time.

Payments

- No payments.

Non-goals

- No scheduled or time-based auto-closing.
- No external integrations (no webhooks beyond Telegram, no storing exports in external services).
- No per-chat role management beyond the admin list configured for the bot.

BotSpec-style tests (required)

Include BotSpec-like test cases that assert both happy-path flows and edge cases for callback behavior. Example tests (describe as BotSpec scenarios):

- Create poll happy path
  - Tap Create poll -> send question -> add 3 options -> toggle anonymous ON -> Done -> Post poll -> assert message created with 3 option buttons and [Results], [Close poll] visible only to creator, [Export] visible to creator.

- Minimum and maximum options
  - Try Done with 1 option -> expect builder rejection message.
  - Add 6th option attempt -> expect rejection.

- Voting and duplicate vote handling
  - Tap option A -> expect callback "Vote registered" and counts updated.
  - Same user taps option B -> expect previous vote replaced; counts reflect single vote.

- Anonymous vs named results
  - Named poll: vote by users A and B -> Results shows counts and a short list of voters.
  - Anonymous poll: Results shows counts only; ensure that export excludes voter identifying columns.

- Closed poll behavior
  - Creator taps Close -> poll is set closed, voting buttons disabled -> further vote attempt returns callback "Poll is closed".

- Invalid callback handling
  - Simulate stale callback data (old message with removed poll) -> expect answerCallbackQuery with "Action no longer available" and no crash.

- Export
  - Creator taps Export -> bot sends a CSV document to requester only; test CSV shape for named and anonymous polls.

- Permission tests
  - Non-creator, non-admin cannot see Close or Export; attempts to call those callback endpoints are rejected server-side.

Implementation notes for engineers

- Callback payloads should be compact JSON with poll_id and action and signature/version to reject malformed/stale payloads.
- All state-modifying operations must be idempotent and protected by DB constraints (one Vote per poll+user). Use transactions.
- Rate-limit edits to avoid hitting Telegram message edit limits (batch updates or coalescing per-second).
- Admins are read from an environment variable BOT_ADMIN_IDS (comma-separated Telegram user ids).

## Assumptions & defaults

- Polls are created and posted in the same chat where the user taps Create poll. Rationale: avoiding complexity listing other chats and ensuring the bot can post to that chat.
- Duplicate votes overwrite previous vote (latest selection wins). Rationale: common, intuitive behavior for quick polls.
- Persistence: single-file SQLite by default (migrations included). Rationale: simplest production-capable store for small teams; easy to migrate later.
- Admins configured via env var BOT_ADMIN_IDS (CSV of user ids). Rationale: simple secure admin list without extra UI.
- Export format: CSV delivered as a Telegram document; named polls include voter id and display name, anonymous polls exclude voter identities. Rationale: CSV is concise and easy to import into spreadsheets.
- No auto close or scheduled tasks. Rationale: keep scope small and deterministic; manual close by creator/admin per requirement.
- Builder runs in the same chat where Create poll is tapped; typed inputs are allowed only for question and options, controls done with inline buttons. Rationale: satisfies "entirely with inline buttons, not slash commands" for controls while allowing needed free text.
- Results display: bot edits the poll message for live totals and also provides an on-demand Results view via callback. Rationale: both passive and active results access.

