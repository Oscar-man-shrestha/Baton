# Handoff 0.3.20 — send detection that does not depend on key presses

Live, on 0.3.19: the line under Grok's composer appeared (the visible-editor fix worked), but sending “ok” was still not counted.

- **New send signal:** the composer going from text to empty, which is what sending does. Enter, or a Send/submit button with text, still counts too. Some editors may swallow key events before the extension sees them, so key presses are no longer required.
- **Confirmation:** a signal must be followed within 90 s by a message of yours not seen on the page before. Handoff keeps a running set of messages already seen, seeded when the page loads, so it no longer matters whether the page shows your message before or after clearing the composer. Clearing the box by hand, opening, scrolling or switching chats never counts, because no new message of yours appears.
- **Grok message identity:** Grok's unique `turn-heading-<id>` is used, so sending the same text twice (“ok”, “ok”) counts twice. Before, Grok messages were identified by their text.
- One test for Grok identity.

Verified: 192 tests in 27 files, typecheck, WXT build; build-1 synced. Not checked live.
