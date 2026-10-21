# Handoff 0.3.13 — Claude usage page checked against the real page

Checked against `claude.ai/new#settings/usage`, saved in Brave on 22 Oct 2026 (Pro plan). Handoff now reads:
- **Session**: 41% used, resets in 3 hr 16 min.
- **Weekly** (All models): 6% used, resets Sun 12:30 AM.
- **Full reset (expires Oct 22)**: 1 left, from Claude's “Limit resets” section.

Fixes:
- Countdowns written as “3 hr 16 min”, “2 hrs” or “45 mins” were not understood, so Claude's session reset was dropped.
- Claude's banked full-reset offer is now shown.

Claude's bars use `role="meter"`; the existing row reader handles them. Three tests in `tests/claude-usage.test.ts` use a trimmed copy of the real markup.

Verified: 175 tests in 24 files, typecheck, WXT build; build-1 synced. Still open: the user's live sidebar showed no Claude reading after Refresh all on 0.3.11. The reader works on the saved page, so the cause is likely timing or reach in the background tab; waiting on the Refresh all status line.
