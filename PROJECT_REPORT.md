# Handoff project and UI/UX report

Version 0.2.0 — 2026-10-21. This is a browser extension, built with WXT, TypeScript, and Manifest V3. It is a local-first context library and draft transfer tool. The project is not yet accepted for a public release: live provider checks, Google cloud setup, and real multi-model handoff evaluation remain open.

## Main user journey

1. Open an AI chat and open Handoff. An already-open tab connects without reloading when browser permissions allow injection.
2. Home shows actual saved context, project, and folder counts; Capture this chat, New context, New folder, and recent contexts. No account is required for local use.
3. Capture visible messages, optionally scroll to include older rendered messages, and restore the reading position. The receipt describes coverage limitations.
4. Inspect goal, where the chat left off, and next step. Choose Compact handoff or Full captured conversation. Review/edit and optionally add an explicit next task.
5. Review first, choose a destination, then open an unsent draft or copy/download the text. Handoff never presses Send. Oversized drafts are kept intact for copy/download; automatic insertion is blocked above 1,500 approximate tokens.
6. Save a project and edited draft, optionally in a folder. Reopen it from Saved or recent items. Export/restore a full local backup. Configured Google/Supabase backup is optional and explicitly initiated.

## Interface inventory for Stitch or another designer

- Home: Handoff arrow mark, local/connected account pill, sidebar and settings buttons; Home/Saved navigation; active-site status; three library counts; primary capture action; older-history checkbox; New context/New folder; recent saved cards; calm empty state.
- Review: short real-data goal/progress/next summary, capture receipt, compact/full selector, expandable editor, next-task input, destination selector after review, optional project save and capture details. Sticky Copy and Review/Open action area remains reachable.
- Saved: search across titles and folders; project and recent-context cards; reopen action; settings/backups link.
- Account/backups dialog: full JSON download/restore; cloud configuration status; configured Google sign-in, Back up now, Restore, Disconnect, and Delete cloud backup.
- Sidebar: same functional application in a browser side panel, responsive down to 320 pixels. If unsupported, the button opens a workspace tab.
- Usage: collapsed cross-provider overview, separate recognized session/weekly/model/feature windows, progress bars, resets and observation times, optional desktop alerts. Small non-interactive strip below the provider composer; hidden if it cannot fit without covering controls. It can be turned off.
- Settings: searchable projects, folder editing, export/import, service toggles and intent preferences, diagnostics, retention and deletion controls.

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

Supabase integration code and owner-only SQL are prepared. A configured build uses Google OAuth/PKCE and exact project host access; app authentication is kept in browser session storage. Upload happens only on Back up now. It stores one current snapshot per user, not a version history or real-time collaborative database. It is not end-to-end encrypted. `CLOUD_SETUP.md` records the remaining setup and live tests. A disabled/configuration-pending feature is not reported as a working login.

## Usage accuracy and current boundary

The active connection reads visible service notices and semantic progress indicators outside captured messages and known extension widgets. Recognized windows and features are displayed separately. Null/unavailable figures remain unknown; expired readings are not reset to an invented zero. Prompt tokens are approximate and never converted into a claimed universal free-tier balance.

Claude Monitor was audited at a pinned public commit. Its private usage APIs and reply metadata explain its richer measurements. Handoff's numeric parser is tested in isolation; private authenticated polling, response interception, and binary stream decoding are not enabled. The user's permission was conditional on avoiding legal/account risk; no such guarantee is available. Continuous exact quotas across all LLMs therefore remain unresolved, rather than being faked.

## What is not implemented or not established

- Automatic AI account switching, cookie/credential manipulation, quota bypass, and automatic submission: prohibited and absent. A normal Gemini link leaves account selection to the provider UI.
- Google/Supabase live authentication and cross-device restore: code prepared, MCP login complete; server tools need reloading, and database/Google provider setup remains pending.
- Continuous exact quota data for every provider: not established. A uniform display does not create access to hidden balances.
- Teams, shared cloud folders, cloud revision history, automatic background cloud sync, semantic embedding search, and attachment/media reconstruction: not implemented. Screenshot-only team counters are not added as fake functionality.
- Optional paid/model-backed summarization and on-device generative ML: not enabled. The default works without a paid API key.
- All signed-in provider selectors/draft insertion, accessibility with assistive technology, store approval, and a two-target three-generation quality score: require the live checklist. No invented score or “best extension” claim is made.

## Verification and supporting files

See `VERIFICATION.md` for exact completed checks, `PHASE_STATUS.md` for phase acceptance, `LIVE_SITE_CHECKLIST.md` for live gates, `RESEARCH_2026-10-21.md` for source inspection findings, and `STITCH_UI_UX_BRIEF.md` for a reusable design brief. The unpacked deliverable is the sibling `handoff-extension-build` folder containing `manifest.json`; do not load the source-project root as an unpacked extension.
