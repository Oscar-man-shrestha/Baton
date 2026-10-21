# Handoff 0.3.16 — every service tracked; learned limits

Research, 22 Oct 2026:
- Similar open-source trackers ([ai-usage-tracker](https://github.com/MuneebQureshi-9/ai-usage-tracker), [deepseek-chat-tracker](https://github.com/rbyers87/deepseek-chat-tracker)) count prompts in a rolling window against a limit the user types in, and mark ChatGPT, Grok and Perplexity as only partly supported.
- DeepSeek publishes no free chat cap. xAI does not publish Grok's free limit (testers report roughly 10–50 messages per 2 hours). Perplexity's free plan reportedly gets about 3 Pro searches a day.

Changes:
- **Message counts for every service**, in the service's rolling window: 2 h for Grok, 24 h for DeepSeek and Perplexity, 5 h for Claude, Gemini and ChatGPT. Only messages you actually send are counted (same send detection as the live estimate).
- **Learned limits instead of typed guesses.** When a service shows its limit, Handoff notes how many messages were sent in that window, at most once an hour. It then shows, for example, “12 msgs in last 2 h · limit hit after ~20 last time · ≈8 left (learned)”, using the median of the last three limits. Before any limit has been seen, only the count is shown.
- Shown under the composer instead of “Usage left: unknown”, in the sidebar usage card, and in the Usage window, all labelled “counted by Handoff”.
- **DeepSeek, Grok and Perplexity are on by default**: destination list, rescue card, suggestions and Settings. They can still be switched off in Settings. Capture and draft insertion on these three have not been tested live yet.
- Four tests in `tests/message-counts.test.ts`; rescue tests updated for the new defaults.

Live, on installed 0.3.15: Handoff matched Claude's own Usage page exactly (recorded in LIVE_VALIDATION_2026-10-21.md).

Verified: 186 tests in 26 files, typecheck, WXT build; build-1 synced.
