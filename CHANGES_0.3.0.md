# Handoff 0.3.0 — Capsule-style library and durable captures

2026-10-21

## Implemented

- Replaced the task-first home with the requested Capsule Infinity-style dashboard: account pill, sidebar button, three real counters, Capture Page / New Capsule / New Folder quick actions, six recent capsule cards and View All.
- Adapted the charcoal surfaces, violet accents, spacing and card structure from the MIT-licensed popup source. Included the original copyright/license notice in source and loadable build. Handoff retains its own identity and backend configuration.
- Capture Page includes older rendered messages by default, within the existing bounded scroll routine, and restores the reading position. Capture settings can disable scrolling.
- Every successful capture with an available archive saves a full, redacted, durable capsule snapshot. Repeating an unchanged capture reuses its content fingerprint. User edits and names on that snapshot are retained; changed conversations get a new snapshot.
- Recent items provide Copy and Delete. View All supports search. New Capsule opens a small name/context/folder form and saves immediately. New Folder works from the dashboard. Existing projects and recent chats remain accessible; no migration clears them.
- Opening a saved full capsule restores its snapshot even if the live conversation archive has changed. Full copy/download retain stored text. A visible compact-handoff action handles drafts above the insertion budget while keeping the full saved capsule.
- Provider selection, review, draft-only insertion, redaction, local backup/restore and the sidebar remain available.
- Usage stays an additional, separate display. Actual provider observations are shown; unknown values are not fabricated.

## Reference and boundaries

Reviewed current public repository and local source at `85880642c6a4f3f9296b5282c184c47e6f3705cf`:
https://github.com/ahmadiscoding/capsule-infinity-chrome-extension

Read popup markup/actions, generic content capture, storage, authentication and previous research notes. The popup's Capture Page path reads selected text or up to 3,000 body characters. Its content script has a separate scrolling/compression pipeline. Neither the README's 100% coverage claim nor the compression-fidelity claim proves lossless capture on every live page. Handoff keeps role-aware capture and complete stored text rather than adopting the body-text cutoff.

Not equivalent to their hosted product yet:

- Supabase public configuration and the owner-only backup table are now installed on the user-selected project, with transactional RLS checks passed. Google provider is disabled; client/redirect configuration and live OAuth/backup acceptance remain pending. Their project credentials and production servers are not reused.
- No hosted generative compression server or paid model service was added. Handoff's compact mode remains local extractive selection, with a full saved snapshot alongside it.
- Teams/collaboration are not implemented; the dashboard does not display a fictitious Teams count.
- Hidden media/history that a service never renders cannot be recovered by DOM capture. Scroll/storage bounds remain documented.
- Exact all-provider quota balances and private Claude usage connections remain unavailable under existing restrictions. Live provider checks are still required.

## Verification

106 tests in 16 files, TypeScript check, production build and isolated Brave UI/content checks. Browser fixtures do not establish signed-in provider or cloud compatibility. See VERIFICATION.md and sibling ui-previews reports for actual outcomes.
