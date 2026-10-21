# Handoff 0.3.9 — Refresh all

- The Usage window's **Refresh open AI tabs** is now **Refresh all**. It still refreshes every open AI tab. Then, for each enabled service with its own usage page (Claude and Gemini so far), it reuses an open usage tab, or opens the page in a **background tab**, waits up to 20 s for a new reading, and closes only the tabs it opened.
- The status line names each service: “read”, or “not shown (signed out or page changed)”. Services without a usage page update only when they display a limit.
- It runs in the background worker, so it finishes if the popup closes. Only an extension page can start it. It reads what the service's own page displays, like opening the page yourself; no private APIs.
- Three tests in `tests/usage-refresh.test.ts`.

Verified: 153 tests in 21 files, typecheck, WXT build; build-1 synced. Not checked live.
