# Baton Pass 0.3.24

**Baton Pass** (shown as **Baton** in the extension; formerly *Handoff*) keeps your AI project context and its usage limits in one place, and passes the project to another AI as a draft you send yourself.

Context library: Capture Page, New Baton, New Folder, recent copy/delete, searchable library and sidebar. Captures save full snapshots; compact handoffs can be reviewed and opened as drafts in another AI. No automatic send.

Supabase owner-scoped storage is configured and SQL isolation checks passed. Google sign-in, explicit cloud backup, and same-installation restore passed live in Brave on 2026-10-21. The existing local library was retained. Cross-device restore, session expiry/restart, cancellation, and cloud deletion remain untested. Local saves and full backup/restore require no account. Exact hidden provider quotas remain unavailable.

See [CHANGES_0.3.0.md](CHANGES_0.3.0.md), [VERIFICATION.md](VERIFICATION.md), [CLOUD_SETUP.md](CLOUD_SETUP.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

See [LIVE_VALIDATION_2026-10-21.md](LIVE_VALIDATION_2026-10-21.md) for the installed build and live cloud evidence. The 0.3.2 sidebar follows tab changes without replacing an edited draft.

## Development and earlier architecture notes (historical)

> **0.2.1 follow-up:** see `REQUIREMENTS_STATUS.md` for all nine requested outcomes, including incomplete cloud and quota integration. This release fixes reset drift, alert races, stale badges, malformed quota parsing, and cross-tab reading updates.

> **0.2.0 local build:** improved capture and Markdown, dashboard/recent contexts, full local backup, and sidebar. Google/Supabase code is prepared but not configured; exact continuous quotas across all providers are not established. See `PROJECT_REPORT.md`, `VERIFICATION.md`, and `CLOUD_SETUP.md`. Load the sibling `handoff-extension-build` folder, which contains `manifest.json`.

# Baton browser extension

Local Chrome MV3 prototype for carrying a compact project brief between distinct AI chat services. The user reviews the text and chooses when to send it. A Gemini shortcut opens the service for manual choice in Google’s own account menu. Baton never changes accounts itself, reads passwords or cookies, or submits messages automatically. Apart from what pages show, it requests only the services' own usage addresses with the user's existing sign-in (see PRIVACY.md).

## Try the local build

1. **Existing Brave installation:** keep `handoff-extension-build-1` and reload it to retain extension ID `jpjfbhobndoekfmknlhdpmcndchiilog` and saved data. Loading a different folder creates a different identity. For a new installation of the prebuilt package, open `brave://extensions` or `chrome://extensions`, turn on Developer mode, click **Load unpacked**, and select the sibling **`handoff-extension-build`** folder. Its `manifest.json` must be directly inside the selected folder. The `handoff-extension` folder containing this README is source code and cannot be loaded directly.
2. To build from source instead, run `npm install`, `npm test`, `npm run typecheck`, and `npm run build` in this folder, then select its `.output/chrome-mv3` folder in **Load unpacked**. If using the ZIP, extract it and select the folder with `manifest.json` at its root.
3. Open a supported chat, click Baton, capture rendered turns, review the draft and receipt, then choose a destination. The destination prompt continues naturally instead of requesting a “Ready” acknowledgment. For a long chat, you may first select **Try to include older messages**; Baton temporarily scrolls the chat and restores your place. This is best effort, so review for missing messages. If Baton cannot find the original user message, it stops the transfer and asks you to try older-message capture or paste the request. The whole draft must fit 1,500 approximate tokens before automatic insertion; shorten an oversized artifact manually. The options page reports whether draft insertion succeeded after a new tab loads. If it fails, use Copy draft and paste it manually.
4. You can save a brief as a local project and reopen a recent project from the popup. Settings lets you search projects, copy a readable handoff, delete one project, or export/import the library. Capture details lets you copy the locally archived rendered chat text; the archive is capped and may be incomplete.

Supported site patterns in the manifest: ChatGPT, Claude, Gemini, DeepSeek, Grok, Perplexity. The last three are best-effort only. A local selector check is available in Settings and projects. Provider DOM layouts change; synthetic fixture passing does not prove live compatibility.

## Privacy and limits

- Content scripts read rendered chat text on the six named sites to build a local transcript and brief. They show an approximate prompt token count below the editor when there is enough room; any free-tier percentage comes only from a visible provider notice. They do not read cookies or provider account identifiers.
- The capture response sends a compact brief and counts to the popup rather than the full raw transcript. Optional older-message capture may temporarily scroll the chat; it restores the prior position on completion.
- `storage` saves bounded transcripts, briefs, projects, preferences, and local diagnostics. The options page offers 7/30/90-day expiry for saved briefs and projects, checked when Baton opens. `tabs` opens a user-selected destination and `activeTab` supports the current-tab workflow. No broad all-sites access is requested.
- The extension does not run a server or analytics. It does not make provider API requests. Remote selector refresh code exists but is not exposed to users or enabled by default; future use would require a pinned SHA-256 hash and HTTPS.
- The meter labels visible banner evidence or local-history inference. ChatGPT text chat and tool quotas are distinct. No estimate is exact.
- Secret redaction is a regex safety net, not a guarantee. Users must review the draft before transferring it.

## Current verification

Automated tests cover synthetic DOM fixtures for six sites, visible-text sanitization, seeded secret classes, provenance, trimming behavior, meter labeling, prompt classification, and project merge semantics. `npm run eval` reports pending until real target responses are supplied. See [PHASE_STATUS.md](PHASE_STATUS.md) and [LIVE_SITE_CHECKLIST.md](LIVE_SITE_CHECKLIST.md) for the remaining release work.
# Usage alerts in 0.1.2

Open **Usage across AI chats** in the popup to see recent, directly visible limit notices for ChatGPT, Claude, Gemini, DeepSeek, Grok, and Perplexity. The balance stays unknown when a service does not show one. Turn on **Desktop alerts** there if you want browser notifications; Chrome asks for permission at that point. Baton alerts at 80% and 95% only when a displayed service percentage supports those numbers, and it can alert on a visible near-limit or reached-limit notice. The extension does not access cookies, tokens, or private usage endpoints. Open each service at least once to observe it; balances older than one hour are shown as unknown.

**Already-open chat tabs:** Open Baton on a supported tab and it connects to that tab without reloading the page. It watches messages from that point onward. On a brand-new chat, it says it is connected and asks you to send a message before capturing. The small line below the prompt bar shows “Usage left: unknown” until the service displays a relevant notice. It may hide if the page leaves no safe space below the composer.

## Changes in 0.1.4

- Gemini capture removes duplicated speaker chrome and retains useful Markdown structure. The compact handoff carries more of a long answer's actionable details.
- Automatically saved recent chats appear beside named projects in the popup. Optional local folders help organize projects.
- The usage panel can open Claude's own usage page. Baton reads a labeled session percentage there if visible, labels an older cached reading, and otherwise leaves the balance unknown. This has synthetic tests but still needs a signed-in Claude test.
- Historical 0.1.4 status: Google sign-in was not implemented then. Current Google/Supabase backup is configured and live-tested as described above. Google Drive backup is not implemented.

Usage is available from the header button. See [GOOGLE_LOGIN_SETUP.md](GOOGLE_LOGIN_SETUP.md) for the exact Google Console and Supabase fields, including Copy extension callback in the app.

Baton is an independent extension, not affiliated with or endorsed by OpenAI, Anthropic, Google, DeepSeek, xAI or Perplexity. ChatGPT, Claude, Gemini, DeepSeek, Grok and Perplexity are trademarks of their owners.
