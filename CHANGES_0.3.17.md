# Handoff 0.3.17 — Grok fixed against its real page

Checked against a grok.com chat saved in Brave on 22 Oct 2026.

- **Grok messages were never found.** Handoff skips anything inside an element whose class mentions “sidebar”, so chat titles are not read as messages. Grok wraps its whole app in `group/sidebar-wrapper`, so every message was skipped, and sends were never counted. Layout classes containing “sidebar” (wrapper, inset, provider, layout, container, trigger, rail) no longer count as a sidebar; real sidebars are still skipped. Elements whose id mentions “sidebar”, and nav/aside, are skipped as before.
- **Hidden speaker labels removed.** Grok starts each message with a hidden “You”/“Grok” heading marked `data-no-copy`, which turned “hey” into “Youhey”. Anything a page marks `data-no-copy` is now left out of message text.
- On the saved page Handoff now reads all eight messages with the right roles.
- **DeepSeek:** live, 0.3.16 counted “2 msgs in last 24 h · counted by Handoff”. The saved `platform.deepseek.com/usage` page is the API billing page ($0.00, 0 requests), not the free chat, so it is not read.
- Two tests in `tests/grok-capture.test.ts` use a trimmed copy of the real markup.

Verified: 188 tests in 27 files, typecheck, WXT build; build-1 synced. Not checked live: Grok send counting after this fix.
