# Handoff 0.3.14 — live estimates, Refresh usage button, auto-refresh on open

Services show usage only on their own usage pages, and those pages load their numbers once, so a fully live official reading would need automated reloading. Instead, this release makes it feel live, using safe methods only:

- **Live estimate between readings.** Every official reading is saved as a calibration point, and Handoff counts the messages you **send** after it. A send counts only after Enter in the composer or a Send button, followed by a new user message within 20 s; opening, scrolling or switching chats never counts. Two readings with sends between them give a per-message cost (median of the last five), and the reading moves forward live:
  - with a learned cost: “Session ≈47% used · est. · 3 msgs since 41% at 01:08 · resets in 2h 10m”;
  - without one: “Session 41% used at 01:08 · 2 msgs since …”, with no invented number.
  Estimates are capped at 100%, stop at the window's reset time and after six hours, and never apply to ChatGPT's Work/Codex limits, credits or feature caps. Badges, alerts and the rescue card still react only to official readings. The sidebar updates as soon as a message is sent.
- **↻ Refresh usage** on the dashboard, below Capture settings, runs Refresh all and shows the result beside it.
- **Refresh when Handoff opens** is now **on by default**, at most every **10 minutes**. It can be switched off in the Usage window.
- Live, on installed 0.3.13: the Claude sidebar card and composer line showed Session 41% used and Weekly 6% used (resets in 2d 23h).
- Seven tests in `tests/usage-estimate.test.ts`.

Verified: 182 tests in 25 files, typecheck, WXT build; build-1 synced. Not checked live: send counting on each service, and the dashboard button.
