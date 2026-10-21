# Your nine requirements — Handoff 0.2.1

Checked 2026-10-21 against the source and test evidence. “Implemented” below means present in the local build; it does not mean verified on every signed-in provider page. No requirement is silently treated as complete.

## 1. Learn from Claude Monitor and use the same clear usage display

**Display implemented; equivalent live data integration incomplete.** Read its website, README, background usage requests, page stream reader and security notes at a pinned commit. Handoff provides separate observed windows, thin progress bars, source times, reset countdowns, toolbar snapshots and optional threshold alerts, including a small below-composer strip. All six supported services use the same display rules.

Claude Monitor's data comes from private Claude usage APIs and reply metadata. Handoff has a tested numeric-shape parser, but the private API/stream connection remains disabled under the original brief and your condition about legal/account risk. Copying its UI does not establish permission or produce the same data on other providers. Sources: [Claude Monitor](https://claude-monitor.com/), [repository](https://github.com/claude-monitor/claude-monitor-browser-extension).

## 2. Learn from AIHero's handoff approach

**Applied locally; real destination quality still needs live evaluation.** The handoff includes goal, progress, decisions with provenance, uncertainties, next step, and retained code artifacts. You can explicitly state what the next AI should do. Full context is available when a compact handoff omits details. Durable local saves avoid temporary-file loss. References alone are not substituted for code when the next web service cannot access those files. Outbound drafts and exports run through redaction. Source: [AIHero handoff](https://www.aihero.dev/skills-handoff).

## 3. Accurate limits for every LLM

**Partially achieved; exact continuous account balances are not implemented for every LLM.** Visible service observations are distinguished from unknown balances and approximate prompt tokens. Session, weekly, model and feature limits stay separate. Unknown is never invented as 0%. Reset/stale observations expire.

The 0.2.1 audit fixes specific correctness faults: decimal/negative percentage parsing, unrelated retry notices being mistaken for quota exhaustion, relative countdowns drifting forward, expired unchanged labels resurrecting a window, notification races, stale/incorrect toolbar selection, and open chats failing to receive another tab's quota update. The toolbar keeps the most constrained valid bucket and clears stale readings when refreshed/activated. No new quota-access API or alarm permission is introduced.

A provider that exposes no account-specific balance still shows unknown. These fixes cannot establish a hidden free-tier remainder. Actual provider notices, resets and account changes remain live-test gates.

## 4. Study competitors and avoid the problems behind poor ratings

**Source research completed for identified public repositories; causal review claims remain unverified.** Capsule Infinity, ctxport, Capsule, extractGptChat and Claude Monitor were inspected. Handoff applies structured message extraction, bounded scroll accumulation, native IDs, preserved code/Markdown, explicit coverage, local saving, error states and non-blocking editor UI. The pasted landscape is retained as research leads.

Store review pages were not retrievable for several cited listings. A low score or tiny review sample does not establish why an extension is poor. Handoff does not invent that explanation or claim to have inspected every extension on the internet. See RESEARCH_2026-10-21.md for URLs, commits, dates, and verified/unverified distinctions.

## 5. A clear dashboard based on your fourth screenshot

**Implemented and checked in an isolated browser.** Home has actual saved context/project/folder counts, Capture, New context, New folder, recent items and View all. Review and advanced controls are revealed when needed. Sticky transfer controls stay reachable. The source version appears in the footer so you can identify the loaded build.

## 6. Capsule Infinity's useful features and familiar UI structure

**Core library workflow implemented; not every Capsule feature copied.** Recent captures, saved projects, folders, exact edited draft reopening, full/compact context, search, copy/download, local backups and a sidebar are present. The dashboard follows the reference's hierarchy with original Handoff branding. Teams, collaboration, cloud revision history and real-time sync are not implemented or shown as fake counters. Provider extraction is independently implemented; its completeness limits are disclosed.

## 7. Account sign-in and saved contexts

**Local persistence works; live cloud sign-in remains incomplete.** Supabase Google OAuth/PKCE, manual backup/restore, disconnect and separate remote deletion are coded. A private owner-only table migration is prepared. The app session is separate from all AI provider credentials.

The supplied Supabase MCP is registered and OAuth-authenticated. This running chat still has no Supabase tools in its tool catalog. Reconnect Codex, then inspect the project before applying the schema. The publishable project key, Google provider/callback setup, row isolation and real cross-device restore must still be completed/tested. No remote schema or account has been created by the agent. See CLOUD_SETUP.md.

## 8. Sidebar option

**Implemented.** The header has a sidebar button. The browser side-panel entry uses the same app and was checked at 320 pixels without horizontal overflow. Unsupported browsers get a workspace-tab fallback. Native side-panel opening still needs a check in the user's actual Brave/Chrome installation.

## 9. Professional, minimal frontend with restrained animation

**Implemented using Stitch references and local CSS.** Stitch review/settings designs were generated and exported. The final dashboard incorporates your later reference: dark charcoal/violet, light mode, compact cards, clear primary actions and disclosures. It supports visible focus, high contrast and reduced motion. Short CSS transitions avoid unnecessary 3D or animation dependencies. No remote scripts/fonts, competitor branding, or fake signed-in avatar ship in the extension.

## Evidence and remaining acceptance

Read VERIFICATION.md and sibling ui-previews reports for exact test results. Isolated browser checks and mocked authentication are not signed-in provider or production cloud verification. The two-target, three-generation handoff harness has no real model responses yet and reports pending rather than an invented quality score. Privacy-policy publication is pending: repo not yet published.
