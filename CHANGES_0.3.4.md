# Handoff 0.3.4

- Captured-chat titles no longer start with “##### You said The following is user-reviewed project context…”. Seen live on 2026-10-21 in the restored library.
  - Gemini's hidden user heading previews the prompt and cuts it with “...”. The old duplicate check needed an exact match, so the heading stayed in the captured text. It is now dropped when the message body starts with the preview.
  - When a chat's first message is a pasted Handoff draft, the goal is now taken from inside it: the `Goal:` line of a compact handoff, or the first user message of a full transcript (multi-line kept). Previously the wrapper sentence became the goal.
  - Captures saved before this fix keep their stored brief unchanged; only the displayed Recent title is cleaned. When the old saved goal is too short to contain the real goal, the title reads “Continued handoff”.
- Six regression tests in `tests/handoff-title.test.ts`.

Verified: 124 tests in 18 files, typecheck, WXT build; build-1 synced. Not yet checked live: re-capturing a Gemini chat that starts with a pasted handoff. Named capsules keep the name they were saved with (usually the browser tab title), so this fix does not rename them.

Known, not changed: a pasted Handoff wrapper's own sentences (for example “Do not reply with only an acknowledgment”) can still be picked up as preferences or tasks from the first user turn.
