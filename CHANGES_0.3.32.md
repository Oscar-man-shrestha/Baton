# Baton 0.3.32 — the usage pill goes below the composer on every site

Live, on 0.3.31, with the new premium pill on all four sites: ChatGPT and Claude were below the composer. On Gemini and DeepSeek the pill went above the box and overlapped its top edge.

- **Why:** a full-width, empty wrapper around Gemini's and DeepSeek's centred disclaimers counted as “occupied”, so the spot below was rejected. The fallback above was also calculated for the old 19 px line, not the 26 px pill.
- **Now:** Baton draws the pill first and measures it, then samples points across the spot where it would sit (left to right, top, middle and bottom). A spot conflicts only if the pill would cover visible text, a control, or the composer itself; empty wrappers do not count. The spots tried, in order:
  1. 6 px below the composer, aligned with its left edge (Gemini, DeepSeek, ChatGPT: the centred disclaimers stay clear);
  2. if a row of controls sits right under the composer, 6 px below that row (Claude's Project / model row);
  3. 6 px above the composer, using the pill's real height.
  The pill hides if none of these is free or on screen.
- The old fixed-height position helpers are no longer used by the page script; their tests remain.

Verified: 224 tests in 32 files, typecheck, complete build; build-1 synced with the completeness guard. Placement depends on live page layout and is not unit-tested; needs a live check on Gemini and DeepSeek.
