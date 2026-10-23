# Handoff project and UI/UX report

Version 0.3.2 — 2026-10-21. This is a browser extension, built with WXT, TypeScript, and Manifest V3. It is a local-first context library and draft transfer tool. The project is not yet accepted for a public release: live provider compatibility, cross-device/cloud lifecycle checks, and real multi-model handoff evaluation remain open. Google sign-in, explicit cloud backup, and same-installation restore passed live in Brave on 2026-10-21. The existing local library was retained. Cross-device restore, session expiry/restart, cancellation, and cloud deletion remain untested.

## Main user journey

1. Dashboard follows the requested Capsule Infinity library structure: capsule/folder/chat counts, Capture Page, New Capsule, New Folder, six recent cards, View All, account/backups and sidebar.
2. Capture Page collects visible and older rendered chat messages by default, bounded by the documented capture limits. Reading position is restored. Available full text is saved as an immutable, redacted snapshot; unchanged captures deduplicate.
3. Open a saved capsule, review full or compact context, choose a destination and open an unsent draft. Full copy/download remain available above the insertion budget. The compact action never replaces the stored full snapshot.
4. New Capsule opens a short form with name, context and optional folder. Recent cards offer copy/delete, and View All searches names and folders. Existing saved projects and recent chats remain accessible.
5. Account/backups offers local export/restore. Google/Supabase backup has a configured public project and owner-scoped table; Google sign-in, explicit cloud upload, and same-installation restore passed live in Brave; cross-device checks remain pending. No account is needed locally.

## Interface inventory

- Dashboard: Capsule-style charcoal/violet cards, real counters, three quick actions, six recent items and a compact active-service usage card.
- Editor: goal, capture receipt, context review and draft transfer; More options contains detailed summaries, format, project/capsule saving and exports.
- Library: search, open, copy and delete controls. Manual capsules and captured snapshots share the same local data store as older projects.
- Sidebar: same application, responsive down to 320 pixels, with a workspace-tab fallback.
- Usage: separate recognized session/weekly/model/feature readings, reset countdowns, observation times, optional alerts and a non-interactive below-composer strip. Missing readings remain unknown.
- Account/settings: local backup/restore, configured cloud actions, retention, provider preferences and diagnostics.

See CHANGES_0.3.1.md for the exact competitor parity boundaries and THIRD_PARTY_NOTICES.md for the adapted layout license.

## Visual implementation

Stitch review/settings references informed spacing, hierarchy, and progressive disclosure. The later Capsule dashboard screenshot informed counts, quick actions, recent cards, account access, and sidebar placement. Handoff retains its own branding. The shipped UI uses local CSS, system fonts, charcoal/violet in dark mode, a light theme, visible keyboard focus, high-contrast support, and short CSS transitions with reduced-motion support. No animation framework, CDN, remote font, or copied competitor logo is required.

## Capture architecture

- Provider adapters support ChatGPT, Claude, Gemini, DeepSeek, Grok, and Perplexity. The latter three remain opt-in/best effort by default.
- Sanitized DOM-to-Markdown preserves structural text: headings, lists, links, checkboxes, tables, code language/fences/indentation, and explicit unavailable-media placeholders.
- Gemini chooses actual message bodies before broad wrappers, removing duplicated speaker chrome without deleting literal user wording. Claude combines recognized alternate wrappers.
- Native message IDs distinguish legitimate repeated prompts. Anchored streaming updates replace partial replies. Ordered overlapping windows accumulate history; broad text deduplication is avoided.
- Older-message capture waits for mounted messages, walks overlapping scroll windows with time/step bounds, and restores position. It cannot prove that a provider loaded all history. Gaps, streaming changes, and the 300,000-character archive cap are disclosed.
- Local extractive summarization uses section coverage, query relevance, and redundancy reduction. User commitments and assistant proposals remain different. Verbatim latest code artifacts are retained; an oversize artifact triggers the insertion gate.
- Full exports contain source, timestamp, role-labeled stored turns, and coverage notes. Secret redaction runs before outbound export/draft rendering. It is pattern-based and can miss sensitive material; the user reviews it.

## Data and backups

Chrome local storage holds archives, incremental briefs, projects, folders, edited drafts, routing feedback, usage observations, and preferences. Retention can expire old captures/projects when the extension opens. Local storage has a browser quota; very large collections may exceed it.

Full backups contain saved chat text, projects, folders, and edited drafts. They exclude arbitrary settings/API keys/authentication records. Schema validation, a SHA-256 integrity check, a 20 MB import limit, and newer-local-copy preservation protect restore. Integrity checks are not encryption or proof of authorship.

Supabase integration is configured with the public project key; the owner-only table is applied and transactional isolation checks passed. A configured build uses Google OAuth/PKCE and exact project host access; app authentication is kept in browser session storage. Upload happens only on Back up now. It stores one current snapshot per user, not a version history or real-time collaborative database. It is not end-to-end encrypted. `CLOUD_SETUP.md` records the remaining setup and live tests. A disabled/configuration-pending feature is not reported as a working login.

## Usage accuracy and current boundary

The active connection reads visible service notices and semantic progress indicators outside captured messages and known extension widgets. Recognized windows and features are displayed separately. Null/unavailable figures remain unknown; expired readings are not reset to an invented zero. Prompt tokens are approximate and never converted into a claimed universal free-tier balance.

Claude Monitor was audited at a pinned public commit. Its private usage APIs and reply metadata explain its richer measurements. Handoff's numeric parser is tested in isolation; private authenticated polling, response interception, and binary stream decoding are not enabled. The user's permission was conditional on avoiding legal/account risk; no such guarantee is available. Continuous exact quotas across all LLMs therefore remain unresolved, rather than being faked.

## What is not implemented or not established

- Automatic AI account switching, cookie/credential manipulation, quota bypass, and automatic submission: prohibited and absent. A normal Gemini link leaves account selection to the provider UI.
- Google/Supabase live authentication and cross-device restore: public configuration and database isolation checks complete; Google sign-in and real authenticated backup/restore passed in the installed Brave browser; cross-device and session lifecycle tests remain pending.
- Continuous exact quota data for every provider: not established. A uniform display does not create access to hidden balances.
- Teams, shared cloud folders, cloud revision history, automatic background cloud sync, semantic embedding search, and attachment/media reconstruction: not implemented. Screenshot-only team counters are not added as fake functionality.
- Optional paid/model-backed summarization and on-device generative ML: not enabled. The default works without a paid API key.
- All signed-in provider selectors/draft insertion, accessibility with assistive technology, store approval, and a two-target three-generation quality score: require the live checklist. No invented score or “best extension” claim is made.

## Verification and supporting files

See `VERIFICATION.md` for exact completed checks, `PHASE_STATUS.md` for phase acceptance, `LIVE_SITE_CHECKLIST.md` for live gates, `RESEARCH_2026-10-21.md` for source inspection findings, and `STITCH_UI_UX_BRIEF.md` for a reusable design brief. The unpacked deliverable is the sibling `handoff-extension-build` folder containing `manifest.json`; do not load the source-project root as an unpacked extension.
