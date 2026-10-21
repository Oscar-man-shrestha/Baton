# Handoff 0.3.11 — catch more limit messages; optional auto-refresh

Safe methods only: Handoff reads what each service displays. No private APIs, no session tokens.

- **Plain-text limit messages:** many services print the limit beside the composer without an alert role. Handoff now also reads short (≤240 characters), visible text with strict wording such as “You’ve hit the Free plan limit…”, “You’ve reached your limit of 20 messages…”, “You are out of free messages…” or “message limit exceeded”. It ignores chat messages, sidebars, the message box, other extensions and long paragraphs that only mention limits.
- **ChatGPT feature caps are named:** Images, File uploads, Deep research, Voice and Model limits. ChatGPT chat keeps working after these, so they never trigger the rescue card.
- **More reset wordings:** “try again after 4:12 PM”, “available again at 9:30 AM”, “until 6:00 PM”, “try again tomorrow at 1:30 PM”.
- **Optional auto-refresh** (Usage window, off by default): opening Handoff runs Refresh all when it has not run for 30 minutes. This cap also stops a signed-out service, whose reading never updates, from reopening on every popup.
- 13 tests in `tests/limit-messages.test.ts`. The message wordings in them are representative; exact live text for ChatGPT's and Grok's limit messages has not been captured yet.

Verified: 171 tests in 23 files, typecheck, WXT build; build-1 synced. Not checked live.
