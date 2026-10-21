# Handoff 0.3.5

- A pasted Handoff draft no longer feeds its own wording into the new chat's preferences and tasks. Before this fix, a chat that started with a pasted draft picked up:
  - “Do not reply with only an acknowledgment.” (the draft's closing instruction) as a preference;
  - “Coverage: … history never rendered …” (a full-transcript header) as a preference;
  - “Next step: …” (a compact-draft label) as a task;
  - any assistant sentence quoted inside the draft, such as “You should never skip tests.”
- From a pasted draft, only the user's own content counts now: the items under “Preferences and constraints” and “Open tasks” of a compact draft, or the “## n. You” messages of a full transcript (nested drafts handled up to three levels). Text the user adds before or after the draft still counts, including the “Next task from the user:” line Handoff appends.
- The closing instruction is now one shared constant, so the wrapper and the filter cannot drift apart. Draft text is unchanged.
- Three regression tests in `tests/handoff-title.test.ts`.

Verified: 127 tests in 18 files, typecheck, WXT build; build-1 synced. Not checked live. A chat's rolling brief is rebuilt from its turns whenever Handoff observes or captures it, so older briefs correct themselves the next time that chat is open. Saved capsules keep their stored brief unchanged.
