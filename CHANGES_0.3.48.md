# Baton 0.3.48 — a tidy ChatGPT usage row

- **Usage rows are about chat only.** ChatGPT's row used to read "Chat: no limit shown · Work weekly 100% left · Credits 2,500 left · Limit resets 0 left · Work 5-hour 100% left". It now reads "**Chat: no limit shown**" with a small "**＋ Work & credits**" note. Hovering or focusing the note lists the other allowances, one per line. Other services with non-chat allowances get "＋ Other limits".
- "Limit resets 0 left" (ChatGPT's banked limit resets) is now called "**Banked limit resets: 0**", and only in the note.
- `laneFor` returns the chat detail and a separate `extras` list. Tests are updated, plus a new one for the banked resets wording.

Verified: 243 tests, typecheck, complete build; the usage list rendered in the built extension with sample ChatGPT and Claude readings. build-1 synced.
