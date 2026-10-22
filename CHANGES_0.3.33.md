# Baton 0.3.33 — hide the usage bar, bring it back from Baton

- **× on the bar:** a small × at the right end of the usage pill hides it at once on every AI site. It is faint until you hover over the pill and has a focus ring for keyboard users. Its tooltip says how to bring the bar back.
- **Bring it back:** while hidden, Baton's Usage section shows **“↺ Show the usage bar under chat boxes”**. The existing “Show usage below the prompt bar” switch in the Usage window stays in sync with it. Both use the same `composerUsageEnabled` setting, and open pages update immediately.
- The pill itself now takes clicks (the space it uses is checked to be free of text and controls). It is invisible while being measured, so placement never detects itself.
- UI test: the show-bar link exists in the Usage section and is hidden by default.

Verified: 224 tests in 32 files, typecheck, complete build; build-1 synced with the completeness guard. Not checked live.
