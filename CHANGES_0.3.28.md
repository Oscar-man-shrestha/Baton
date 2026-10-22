# Baton 0.3.28 — ChatGPT's new page layout

Checked against a chatgpt.com conversation saved in Brave on 22 Oct 2026.

- **ChatGPT messages were no longer found.** ChatGPT's page no longer contains `data-message-author-role`, which Baton relied on, so it found no ChatGPT messages: sends were not counted (seen live: three messages, no count) and capture would have failed. ChatGPT now keys message units `…:user` / `…:assistant` (`data-chatgpt-search-unit-key`). Baton reads those and keeps the old marker as a fallback.
- **Text:** each unit opens with a hidden “You said:” / “ChatGPT said:” heading. Baton reads the user bubble (`data-user-message-bubble`) or the answer body (`data-markdown-text-style="assistant-message"`), so the headings stay out.
- **Identity:** ChatGPT's message id (`data-chatgpt-search-message-ids`) identifies each message, so two identical “hi” messages count as two.
- **Composer:** `#prompt-textarea` is gone; the composer is a labelled content-editable box, matched by the new `[contenteditable='true'][aria-label]` pattern and the existing fallback.
- **Selector bundle version 6**, so saved ChatGPT chats are rebuilt.
- On the saved page Baton reads all 12 messages with the right roles, unique ids, no heading text, and the “Ask ChatGPT” composer. Three tests in `tests/chatgpt-capture.test.ts`.
- Wording fix: the ChatGPT card's note now says the Codex/Work figures are *below* it.

Live, on 0.3.27: the new Usage layout appeared as intended (current AI card on top, “Other AIs — Claude 68% left · Gemini 99% left” closed, counts line “6 batons · 1 folder · 8 chats”).

Verified: 221 tests in 31 files, typecheck, complete build; build-1 synced with the completeness guard. Not checked live: ChatGPT counting after this fix.
