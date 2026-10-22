# Baton 0.3.25 — Baton's own layout (same colours)

The user asked to keep the colours and change the structure, so Baton no longer reads as Capsule Infinity's dashboard (stat tiles with icons, a row of three equal Quick Action buttons, then a list).

- **Header:** a striped baton mark instead of the “↗” arrow; subtitle “Pass your AI work forward”.
- **Pass card** for the current chat: source line, “Pass the baton” heading, a one-line hint (you always press Send yourself), one wide primary button **“Capture this chat →”**, and smaller “＋ New Baton” and “▱ Folder” buttons. Capture settings are folded in below.
- **Your lanes:** one track per enabled service, the active one first and marked “here”. Each lane shows the best available source (new `src/core/usage-lanes.ts`):
  - the tightest official chat window, e.g. “46% left · Session · resets in 2h 4m”, or “≈” when estimated;
  - otherwise a stated or learned limit (“≈18 left”), or the count (“2 sent · counted by Baton”);
  - otherwise “—”.
  ChatGPT's Work limits and credits appear as extras, never as the chat lane. Unmeasured lanes use a dashed track; lanes under 20% turn the warning colour. ↻ Refresh sits beside the heading, and the detailed card for the current chat follows.
- **Batons:** the stat tiles became one quiet line, “4 batons · 1 folder · 3 chats”, with correct singular and plural. Each Baton row has a left edge in its service's brand colour.
- **Unchanged:** the colour palette (dark and light), every element ID, and all behaviour. The sidebar uses the same markup.
- Four tests in `tests/usage-lanes.test.ts`. The UI test now also checks the new structure: no stat tiles, Capture as the single primary action, lanes above the list.

Visual check: the built popup was loaded in a browser with sample data matching the user's live readings, at popup size; the header, pass card, lanes and coloured list rendered as intended. Light mode and the narrow sidebar were not checked visually.

Verified: 213 tests in 30 files, typecheck, complete build; build-1 synced with the completeness guard.
