# Handoff 0.3.18 — near-live usage after each message

- **Send detection now watches directly.** Before, a send was confirmed only when the page stopped changing, within 20 s. Grok keeps the page changing while it answers, so its sends were dropped (seen live on 0.3.17: Grok capture worked but its count stayed empty). Now Enter, or a Send/submit button, with text in the composer starts a watch for a new message of yours for up to 90 s; it is counted at the moment it was sent. Opening, scrolling or switching chats still never counts.
- **Refresh after each message** (Usage window, **on by default**): about 30 s after you send on Claude, Gemini or ChatGPT, Handoff reads that service's usage page. At most once every 5 minutes per service, and skipped when a reading is under 2 minutes old. Uses an alarm, so it survives the background worker sleeping. Between refreshes, the live estimate fills the gap.
- **Minimised window instead of tabs:** usage pages for Refresh all, refresh-on-open and refresh-after-send load in a minimised window that closes when done, so nothing appears in the tab bar. Usage tabs already open are reused.
- **Privacy:** PRIVACY.md describes when usage pages are loaded and that only send *times* (not text) are stored. The refreshes are disclosed and can be switched off, not hidden.
- One test for the 5-minute / 2-minute throttle.

Live, on 0.3.17: Grok capture worked; the chat title “do grok shows usage” was captured.

Verified: 189 tests in 27 files, typecheck, WXT build; build-1 synced. Not checked live: Grok counting with the new detection, refresh after send, and how Brave on macOS shows a minimised window being created.
