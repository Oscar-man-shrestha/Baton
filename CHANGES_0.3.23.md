# Handoff 0.3.23 — Perplexity fixed against its real page

Checked against a perplexity.ai search thread saved in Brave on 22 Oct 2026.

- **Perplexity messages were never found.** Its messages carry no `data-testid`, so the old pattern matched nothing: no capture and no send counting (seen live: “say hi” and “again” were neither counted nor captured). Questions are now read from `[data-message-bubble="right"]` and answers from `.prose[data-renderer="lm"]`, which leaves out the “Researched” step header. The right-hand bubble counts as the user's message. The composer is the content-editable box.
- **Selector bundle version 5**, so chats saved with the old patterns are rebuilt.
- On the saved page Handoff reads all four messages with the right roles. One test in `tests/perplexity-capture.test.ts` uses a trimmed copy of the real markup.

Live, on 0.3.22: Claude's “≈ … est.” estimate appeared with its explanatory note, and the duplicate-chat merge cleaned Recent (Capsules 10 → 6, Chats 12 → 8). Recorded in LIVE_VALIDATION_2026-10-21.md.

Verified: 208 tests in 29 files, typecheck, complete build; build-1 synced with the completeness guard. Not checked live: Perplexity after this fix.
