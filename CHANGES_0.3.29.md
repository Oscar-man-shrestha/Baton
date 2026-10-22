# Baton 0.3.29 — chat-only line under the composer

Live, on 0.3.28: the line under ChatGPT's composer read “Work weekly 0% used · resets in 5d 7h · Credits 2500 left”. Those figures are ChatGPT's Codex/Work allowance, not chat, so under the chat box they looked like a chat limit and hid the chat message count.

- The line under the composer now shows chat usage only:
  - a service's chat windows, e.g. Claude's Session and Weekly, or Gemini's 5-hour and Weekly;
  - otherwise the chat message count, e.g. “1 msg in last 5 h (counted by Baton)”;
  - otherwise “Chat: no limit shown” when the service shows only non-chat figures.
- Codex/Work, credits, banked limit resets and feature caps (images, files, voice, deep research) stay in the sidebar card and in the line's tooltip.
- Limit notices for chat still appear in the line as before.

Verified: 221 tests in 31 files, typecheck, complete build; build-1 synced with the completeness guard. The line's logic lives in the content script and is not unit-tested; not checked live.
