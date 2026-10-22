# Baton 0.3.30 — a nicer usage bar under the composer

Live, on 0.3.29: Claude's line was right (Session 37%, Weekly 19%). ChatGPT's line read “Usage left: 100% (service notice)”, which was its Work allowance again. On Gemini's single-row composer the line was drawn inside the box.

- **New design:** a compact pill with a small baton mark and one segment per limit, e.g. “Session ▰ 63% left 3h 9m | Weekly ▰ 81% left 2d 16h”.
  - Values say what is **left**, matching the sidebar.
  - Mini bars are teal with plenty left, amber under 50%, red under 20%; estimates show “≈”.
  - Thin dividers, a soft shadow, and a light version for light mode. The prompt token count is a quiet final segment while you type.
  - Built by the tested `chatSegments` helper (new `src/core/composer-line.ts`).
- **ChatGPT fallback fixed:** when there is no chat window, only a chat notice may stand in, never the Work allowance. Otherwise it shows “Chat 2 msgs in last 5 h · counted by Baton” or “Chat no limit shown”.
- **Gemini placement:** Baton now climbs up to 8 levels to the whole composer box. It accepts any box at least as low as the editor, and stops before page-wide wrappers (no wider than 1.6× the editor, or the editor plus 160 px). On Gemini's single-row composer the line now goes below the box instead of inside it.
- Three tests in `tests/composer-line.test.ts`.

Visual check: the pill was rendered with the shipped styles in dark and light, with plenty, low, nearly-out, counted and no-limit cases. Verified: 224 tests in 32 files, typecheck, complete build; build-1 synced with the completeness guard. Not checked live: placement on each site.
