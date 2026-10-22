# Baton 0.3.49 — ChatGPT Work and credits stay visible

- **The bug:** ChatGPT's Work/Codex allowances and credits disappeared from Baton about an hour after Baton last read ChatGPT's usage page. All service readings were hidden after one hour. That's right for chat limits, which move with every message, but too strict for weekly allowances and credit balances.
- **Now:** readings that aren't chat limits (Work/Codex, credits, banked resets, feature caps) stay visible for **24 hours**, labelled with the time they were read. They still go away as soon as their reset time passes. Chat limits keep the one-hour rule. Both behaviours are covered by tests.
- **Fixed a time-dependent test:** `composerStatusText` read the real clock, so a test written for 12:00 UTC failed later in the day. The function now takes the current time as an input (defaulting to the real clock).

Verified: 245 tests, typecheck, complete build; build-1 synced. Still to check with a signed-in ChatGPT: whether ChatGPT's redesigned page (new Chat | Work switch) still lets Baton read the usage page. Press **Read usage ↗** in the ChatGPT usage card. If Work and credits reappear, the reader is fine.
