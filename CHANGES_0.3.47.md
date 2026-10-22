# Baton 0.3.47 — "What's next?" in the pass menu

- The glowing button's menu has a **What's next? (optional)** line under the task chips.
  - Whatever you type is added to the end of the draft as "Next task from the user: …", so the next AI starts on the right step with full context.
  - Personal data and keys are redacted. The step is capped at 300 characters in the box and 500 in the draft.
- **Pre-filled:** on a fresh open, the line starts with any unsent text in the chat box, which is usually the next step. You can edit or clear it.
- **Enter** in the line passes to the Suggested AI, and **Escape** closes the menu. Keys typed there stay in Baton's box, so the chat site doesn't react.
- **The step goes with every action:** passing to an AI, Copy project, and "…, another account", where it's kept in the waiting project.
- **Typing isn't interrupted:** if you start typing before the on-device model answers, the menu doesn't re-rank under you.
- Baton's side panel ("Pass the baton to") has the same line. Pass → and "another account" from there include it.

Verified: 242 tests in 35 files (`withNextStep`: adds, skips empty, tidies, caps, redacts), typecheck, complete build. Browser smoke test: the menu shows the line pre-filled with the typed prompt, and all earlier checks still pass. build-1 synced. Not checked live: a pass from a signed-in chat with a next step.
