# Handoff 0.3.22 — one chat, one entry

- **Duplicate chats from Grok.** Grok adds a new `?rid=…` to its address after every reply. Handoff keyed chats by the full address, so one Grok conversation was saved again after each reply, filling Recent with copies (seen live: two “ok · grok.com” entries, Chats 10 → 12). Chats are now identified by site and path only.
- **Existing duplicates merge on their own.** Recent shows one entry per chat, the newest copy. Deleting it removes every saved copy, so older ones do not reappear. Copies stay in storage, and so in backups, until deleted.
- Two tests in `tests/recent.test.ts`.

Live, on installed 0.3.21: the extension loaded without errors after the build-1 restore, and Grok showed “2 msgs in last 2 h (counted by Handoff)” under the composer and on the card. Perplexity showed the composer line (“Usage left: unknown”) on its start page; counting and capture there are still untested.

Verified: 207 tests in 28 files, typecheck, complete build; build-1 synced with the completeness guard.
