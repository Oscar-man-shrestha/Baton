# Baton 0.3.31 — premium usage pill, placed by the composer's real outline

Live, on 0.3.30: Claude's and ChatGPT's pills were right. On Gemini the pill overlapped the top edge of the composer; on DeepSeek it sat above and to the left of the box.

- **Placement:** the composer is now the outermost ancestor (up to 10 levels) that looks like a box: corner radius of 8 px or more, plus a visible background, border or shadow. It must also reach the editor's bottom, be no taller than 360 px and narrower than 95% of the window. The pill lines up with that box, below it or (fallback) above it. The old size-only rule picked Gemini's inner text field (its box is much wider than its editor) and a wider invisible wrapper on DeepSeek.
- **Premium design:**
  - frosted glass: two-tone gradient, 12 px backdrop blur, fine top highlight and a deeper soft shadow, 26 px tall;
  - a glowing baton mark;
  - small-caps labels (SESSION, WEEKLY, CHAT), with tabular, bold figures (“54%”), a lighter “left” and a muted reset (“3h 1m”) after them;
  - **ring gauges** instead of bars, filled to what is left: teal, amber under 50%, red under 20%;
  - soft gradient dividers between segments, and a matching light theme.
- Visual check: rendered at 1.8× with the shipped styles in dark and light, for the plenty, estimated low, nearly-out, counted and no-limit cases.

Verified: 224 tests in 32 files, typecheck, complete build; build-1 synced with the completeness guard. Not checked live: placement on Gemini and DeepSeek with the new rule.
