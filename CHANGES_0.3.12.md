# Handoff 0.3.12 — library hardening

- Saved projects were read as one all-or-nothing list. If a single stored project could not be read (damaged, or written by a newer version), the whole library appeared empty, and the next save or delete would have written that empty view back, erasing every other project. Backups of such a library also failed completely.
- Each project is now checked on its own. Readable ones are shown; unreadable ones are hidden but kept unchanged through save, delete, expiry and restore. A backup includes every readable project instead of failing.
- No data loss was observed. The smaller library seen on 22 Oct was the user's own deletions; this fixes the weakness found while checking.
- One regression test in `tests/projects.test.ts`.

Live, 22 Oct 2026, installed 0.3.11: ChatGPT's usage page showed Work 5-hour and Work weekly 100% left with resets, Credits 2,500 left and Limit resets 0 left, with no “Chat” row.

Verified: 172 tests in 23 files, typecheck, WXT build; build-1 synced.
