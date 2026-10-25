# Handoff extension — complete continuation brief for Claude Pro

Prepared 21 October 2026, Asia/Kolkata. Current application version: **0.3.2**. Current selector bundle: **4**.

## 1. Assignment and how to begin

The human user is deliberately transferring development from Codex to Claude Pro. Continue the existing Handoff extension. Do not restart it or redesign everything before understanding the working implementation. The user wants the remaining work finished, with accurate usage information, dependable context transfer, saved contexts, Google sign-in, and a simple premium interface inspired by Capsule Infinity.

Read this handoff, then the actual project files. Give a short acknowledgment of the current state and start the highest-priority unfinished task. Do not respond only with “Ready.” Do not ask the user to repeat requirements already recorded here. Work through small changes, test each meaningful fix, record exact results, and keep local commits reviewable.

If you are Claude in a normal web chat, you cannot assume access to this Mac, its browser, MCP connections, or local paths. Ask for the relevant source files from the supplied source archive if your environment cannot open it. Provide concrete edited files/patches and test instructions when execution is unavailable. Never claim you edited, tested, uploaded, or installed anything unless you actually did. If running Claude Code or another authorized local coding environment, use the canonical repository below.

### Locations — distinguish source from the installed extension

- Canonical working Git repository: `/Users/oscar/Projects/handoff-extension/app`.
- Verified source mirror: `/Users/oscar/Documents/Codex/2026-10-20/referenced-chatgpt-conversation-this-is-an/outputs/handoff-extension`.
- **Actually installed Brave folder:** `/Users/oscar/Documents/Codex/2026-10-20/referenced-chatgpt-conversation-this-is-an/outputs/handoff-extension-build-1`.
- Existing installed extension ID: `jpjfbhobndoekfmknlhdpmcndchiilog`.
- Another generated folder, `outputs/handoff-extension-build`, contains the same build, but loading a different unpacked path creates a different extension identity and separate storage. Preserve the existing installation and update **build-1 in place**.
- Loadable files also exist under the canonical repository's `.output/chrome-mv3` after building. The source directory itself has no root manifest and cannot be loaded unpacked.
- Source download: sibling `handoff-extension-source.zip`. Loadable download: sibling `handoff-extension-build.zip`. Extract the build archive before loading its manifest-containing folder.
- Old plain JavaScript prototype: user originally described `handoff-ext` under the project parent. It is reference only. The WXT/TypeScript app is the implementation to continue.
- Workspace with reference repositories and browser verification scripts: `/Users/oscar/Documents/Codex/2026-10-20/referenced-chatgpt-conversation-this-is-an`.
- Clean dependency/build workspace used for validation: `/private/tmp/handoff-validation-20261021`. This is temporary, not the source of truth.

Canonical latest commits at handoff: `dc46722` (live verification documentation), `9af41f4` (0.3.2 live fixes). Mirror equivalent changes: `f6958aa`, `8a2bead`, `31bc361`. Both repositories were clean; **84 source files matched byte-for-byte** before this handoff document was added. No remote push was performed.

## 2. What the user wants — retain every theme

1. Capture the current AI conversation thoroughly: original user goal, every captured user/assistant turn, decisions, constraints, code, unanswered questions, latest progress, and the next action. The receiving AI should continue where the work stopped without re-explaining the project.
2. Learn from Capsule Infinity and other similar tools by reading their actual public code, checking licenses, testing claims, retaining useful patterns, and fixing their shortcomings. The user repeatedly requested parity and improvement, not an unrelated minimal prototype.
3. Keep saved capsules/context, recent items, folders/projects, search, copying/export, and exact edited drafts. Context must survive normal reopening. Google sign-in should allow backup and recovery through the user's own application account.
4. Analyze intent and recommend appropriate **distinct AI services** according to the user's prompt and needs, with usable capacity information when available. Manual choice stays available.
5. Put a small usage line **below** the prompt/composer, showing actual observed usage, percentage left, tokens left only when genuinely available, and resets/alerts. It must never cover typing, voice, attachment, or Send controls. The user specifically disliked intrusive overlays.
6. Use a consistent Claude Monitor-style presentation for separate session, weekly, model, and tool quotas, plus useful toolbar badges and optional alerts. Never invent exact values for providers that expose no balance.
7. Make the frontend understandable at first glance: Capsule-style dark charcoal/violet dashboard, clear Capture/New Capsule/New Folder actions, recent contexts, account pill, Usage button, and sidebar access. Progressive disclosure, restrained animation, light mode, keyboard access, contrast, and reduced motion matter. The user found earlier multi-step forms overwhelming.
8. Provide a sidebar/workspace option, dependable first-use capture without reloading an already-open LLM page, and robust handling of virtualized history and changing layouts.
9. Research before substantial implementation. Record verified versus unverified claims, URLs, dates, and source commits. Investigate low-rated competitors without inventing reasons for their ratings.
10. Keep costs at zero by default. The user has no budget. Supabase for this project is approved; no paid service or subscription is authorized. Heavy animation/3D frameworks were permitted as options, not a requirement to add unnecessary complexity.
11. Produce full documentation and a frontend brief usable in Stitch. The user supplied Stitch configuration previously; generated design references already exist. Do not repeat exposed keys or assume your environment has that MCP.
12. The user said “do not switch models.” Do not silently change the coding model or delegate to another model. This deliberate handoff to Claude Pro is the user's requested transition.

### Reported examples that drove the fixes

- DeepSeek to-do chat: an early version dropped the original user request, cut off the assistant's questions, and instructed the receiving ChatGPT to say only “Ready.” That behavior was wrong. Preserve the goal and unanswered questions, and request natural continuation. A regression fixture exists; a full live DeepSeek-to-ChatGPT acceptance run is still pending.
- Capsule Infinity's supplied DeepSeek export included unrelated sidebar chat titles. Handoff should scope extraction to actual conversation turns and avoid copying the whole page indiscriminately.
- Gemini example: “Hey I wanna make to do list beautiful that works in all edge cases.” Preserve its edge-case guidance, UI advice, JSON/code, feature checklist, and final platform/stack question. Latest packaged live review contained the user request **once**, no “You said”/“Gemini said” chrome, code timestamp `1711902849000`, final Drag-and-Drop Reordering feature, and final tech-stack question.
- A raw capture is useful evidence, but is not automatically an excellent compact handoff. Both full fidelity and continuation quality need separate evaluation.

## 3. Constraints and authorization — latest decisions override old proposals

- **Draft only. Never auto-submit any AI prompt or transferred conversation.** The user reviews it and presses Send in the destination.
- No AI account logout/login automation, cookie reading/swapping, browser profile manipulation, credentials harvesting, or quota/limit evasion.
- The later Google account-switching request was clarified as opening Google's own chooser/profile interface for manual use. A manual Gemini shortcut is allowed; it must not choose accounts or be used to bypass limits. Do not promise that any third-party behavior can guarantee no account restrictions.
- Handoff's own Google/Supabase authentication is approved and distinct from accessing AI provider credentials. Legitimate app OAuth does not authorize touching Claude/ChatGPT/Google AI session cookies.
- Private Claude usage API integration remains **disabled**. The user said “if illegal then no, else yes,” conditional on legal/account safety. This was not resolved into permission to ship private endpoint access. The original brief forbids cookies/internal APIs and allows a response-only experimental spike only if policy/terms gates pass. Do not assert legality or safety from the existence of competitor code. Research terms/policy and seek an explicit scoped decision if necessary; default to visible native UI readings.
- Supabase project `qeoduozlznznptwsfzbt` and optional Google sign-in/manual cloud backup are approved. User explicitly approved exact callback saving, extension identity access, project host access, and later explicit scripting host access on the six existing chat origins. No arbitrary new host access is authorized.
- Uploads of saved Handoff data to this private Supabase account were explicitly approved for the completed backup/restore test. Continue showing what is uploaded and keep uploads user-initiated; broad approval is not permission to publish chats or upload them elsewhere.
- No Git remote creation/push, public hosting, or server deployment. The user will create/push the public repository later. Planned privacy URL: `https://github.com/Oscar-man-shrestha/handoff-extension/blob/main/PRIVACY.md`, **pending: repo not yet published**.
- Ask before paid services, a new remote destination, materially broader permissions, destructive actions, or anything involving account switching/limit evasion. Preserve local data and ask before deleting real cloud backups.
- A Google OAuth secret and Stitch key were previously pasted in chat. **Neither is included here.** Do not request or echo secrets in chat/source. User was told to replace the exposed Google secret and store its replacement directly in Supabase. Rotation/revocation was not independently verified; do not claim it was. Google client-secret entry was performed by the human.
- Research does not authorize wholesale copying of unlicensed code or branding. Keep `THIRD_PARTY_NOTICES.md` and the copy shipped in the build current for every bundled third-party component. Use Handoff branding.

## 4. Existing implementation and code map

WXT, TypeScript, Chrome Manifest V3, Zod, Vitest, `gpt-tokenizer`, and the official Supabase JavaScript client. Dependencies are pinned by `package-lock.json`. No remote frontend scripts/fonts or mandatory paid AI backend.

### Entry points

- `entrypoints/content.ts`: provider-page observation, visible conversation capture, bounded older-message scroll, local archive/brief updates, prompt-token/status strip, usage observation, PING/EXTRACT/REFRESH_USAGE/INJECT_DRAFT messaging. Scroll capture restores the starting position. It reads rendered DOM, not private provider history APIs.
- `entrypoints/background.ts`: selected-provider draft opening/insertion workflow, usage notification/badge delivery, and app Google sign-in handling that survives popup closure.
- `entrypoints/popup/main.ts`, `index.html`, `style.css`: shared dashboard/library/review/account/usage controller and UI.
- `entrypoints/sidepanel/main.ts`: imports the shared popup controller. Sidepanel HTML stays synchronized with popup markup; responsive CSS handles the narrow panel.
- `entrypoints/options/*`: provider preferences, diagnostics/settings/data management.
- `wxt.config.ts`: permissions and exact hosts. `src/selectors.json`: version **4**, bundled per-provider selectors. `src/core/selectors.ts`: validated selector bundle and opt-in hash-verified refresh infrastructure.

### Core modules

- `adapter.ts`, `markdown.ts`: turn roles/IDs, visible-text sanitation, Markdown/tables/links/checkboxes/code preservation, artifacts, editor insertion. Gemini accessible-heading deduplication is fixed for broad message wrappers as well as fallback nodes.
- `capture.ts`: overlapping rendered-window accumulation, identity-aware streaming updates, gap and truncation indicators. Local rendered archive is bounded to about **300,000 characters**. Scroll capture is bounded; it is not a guarantee of complete server-side history.
- `brief.ts`, `extractive.ts`: structured brief, provenance/status fields, goal/preferences/decisions/assumptions/findings/open questions/tasks/latest exchange/artifacts/next step, deterministic extractive selection, redaction, receipt, randomized data-boundary wrapper.
- `context-export.ts`: full transcript export alongside compact handoff. Full context preserves the retained answer tail; redaction runs before outbound copy/export. Full context can exceed the insertion budget.
- `capsules.ts`: durable captured snapshots, SHA-256 content fingerprints/deduplication, preserved saved text even after the rolling live archive changes. Captured capsules are stored as projects with snapshot/full draft fields.
- `projects.ts`, `recent.ts`: named projects, recent captured chats, folders, exact edited drafts, search, merges, individual deletion, local retention/expiry.
- `backup.ts`: checksummed, schema-validated local backup of projects/folders/captures/archives; excludes application settings/API keys; merge preserves newer local copies. Durable capsule fields are carried through the project schema. Version 1 backup envelope.
- `cloud.ts`: Google OAuth/PKCE through `chrome.identity.launchWebAuthFlow`, exact callback validation, verified current Supabase owner, explicit upload, preview/merge restore, local disconnect, separate remote deletion. App auth is in **chrome.storage.session**, cleared on extension reload/browser exit; local contexts remain.
- `active-chat.ts`: revision-guarded active-tab tracking; late responses from a previously active tab cannot restore the wrong provider. Popup/sidebar subscribes to tab activation/navigation. Edited transfer drafts are not replaced just because tabs change.
- `connection.ts`: supported-host guard and packaged script bootstrap when an already-open page has no receiver. Explicit scripting host permissions are necessary for sidebar tab changes because `activeTab` alone is insufficient there.
- `usage-windows.ts`, `limits.ts`: separate observed session/weekly/model/tool windows, percentage/count/token distinctions, provenance/time/confidence, reset/stale expiry, Claude native usage page AND `new#settings/usage` overlay recognition. Existing usage tabs are reused.
- `composer-status.ts`: approximate prompt-token text and safe below-composer position. Content controller also checks whether another surface covers the editor, hiding the strip behind dialogs. Noninteractive, no focus capture.
- `usage-alerts.ts`, `usage-delivery.ts`: optional 80%/95%/reported-limit alerts, deduplication, current provider/tab badge snapshots and stale cleanup. Notification permission is optional and requested when enabled.
- `router.ts`: local TF-IDF + logistic classifier, five intents (planning/coding/writing/research/reasoning), only **15 seed prompts**, editable provider task preferences, capacity-aware ranking from observed signals, local feedback adjustment after 20 samples. Accuracy is unmeasured. DeepSeek/Grok/Perplexity are best-effort and disabled in default ranking until enabled/tested.

### Limits of existing implementation that must not be hidden

- “Continuous brief” currently means page observation and rebuilding/updating from a bounded captured archive. It is not a proven semantic incremental-memory algorithm. Audit evidence retention over long sessions and branches.
- Capture and recommendation use the unsent prompt when requested. Audit the product requirement for intent recommendations while typing; do not assume a live prompt-aware recommendation UI exists just because prompt tokens update.
- Compact handoffs use local extractive selection only. Optional Gemini-key summarization, on-device semantic models, hosted compression, embeddings, teams/collaboration, automatic multi-device sync, and cloud version history are not implemented.
- Cloud stores **one current snapshot per user**, not a live collaborative database. It is not end-to-end encrypted. No automatic background upload occurs.
- Exact unknown free-tier balances cannot be reconstructed from typed token counts. Do not equate context-window size, service message limits, API token balances, tool quotas, or spending.
- No private API/response interception is enabled. Claude metadata parsers existing in source do not constitute a live Claude Monitor connection.
- Hidden/never-rendered history, attachments, images, audio, artifact/canvas internals and revised conversation branches are not universally recovered. Surface limitations clearly rather than saying “all data captured.”
- Automatic draft opening/insertion is blocked above approximately **1,500 tokens** for the whole reviewed message. Stored/full snapshots are not squeezed into that cap. The user can copy/download full context or shorten it explicitly. Do not silently cut essential code to meet a budget.
- Regex redaction is a safety net, not a guarantee of no secrets. Outbound edited drafts are redacted and require review; full local backups intentionally contain saved chat text and need privacy disclosure.
- Some project merge semantics are basic exact-text/artifact-version merges. Do not claim semantic conflict resolution, user-ratified decision tracking, or complete supersession without tests.

## 5. Cloud setup — already done; do not recreate it

- Supabase URL: `https://qeoduozlznznptwsfzbt.supabase.co`.
- Public project configuration is already in `src/config/cloud.json`. A publishable key is intentionally distributable; no privileged key belongs in the extension. Use the file, not a secret from chat.
- Google OAuth Web client ID: `779936109393-51qidivvomdaa5vau7vce5tbk9u30221.apps.googleusercontent.com`.
- Google-to-Supabase authorized callback: `https://qeoduozlznznptwsfzbt.supabase.co/auth/v1/callback`.
- Exact installed extension return URL, saved in Supabase's redirect allowlist: `https://jpjfbhobndoekfmknlhdpmcndchiilog.chromiumapp.org/supabase`.
- Google provider is enabled; human completed secret configuration and Google consent.
- `public.handoff_backups` exists. `supabase/schema.sql` describes it: owner UUID primary key referencing auth.users, backup text max 20 MB, update time; RLS owner-only read/write; anonymous read revoked. Migration is applied. Do not apply destructively again.
- Transactional isolation checks passed: anonymous denied, owner visibility only, cross-owner update affected zero rows, cross-owner insert rejected; fixtures rolled back.
- Live app sign-in, explicit upload and same-installation restore passed. Metadata verified one 38,576-byte snapshot at `2026-10-21T17:07:19.399Z`, with one captured conversation and zero named projects at that time. Later Gemini capture was saved locally; do not assume it was included in that earlier snapshot.
- The final extension reload cleared the app auth session as designed. User may need to sign in again. It did not delete local library or remote backup.
- Supabase MCP was authenticated in Codex, but Claude must check its own connected tools; it does not inherit this connection automatically. The tools used exposed database/log operations, not a Google provider-secret configuration action. Human credential entry was required.
- Google Drive backup is an inactive historical proposal in `GOOGLE_SYNC_DESIGN.md`, superseded by the approved Supabase design.

## 6. What actually passed

### Automated / packaged checks

- **115 tests in 17 files**, final focused project run with two workers; TypeScript check and WXT production build passed.
- Tests cover adapters, capture merging/streaming identities, Gemini broad-wrapper duplicate/speaker removal, Markdown/code, briefs/provenance/redaction/budget guards, routing, local save/backup/capsules, usage parsing/reset/expiry/alerts/delivery, connection bootstrap, active-tab races, shared UI markup and mocked Google PKCE validation.
- Previous isolated Brave UI checks: dark/light popup at 400×600, sidebar at 320 px, real counts, quick actions/folders/manual capsule, search/copy/delete, durable snapshots and unchanged-capture deduplication, preservation after rolling archive change, compact review gate, separate mock Claude 31%/5% readings and callback helpers. These isolated UI fixture runs predate the final 0.3.2 live fixes; do not label them a fresh complete final-build UI pass.
- Previous packaged content fixture checks: 12 virtualized turns, restored scroll position, streaming updates, cross-tab usage delivery, below-input placement, insertion with no submit. These are synthetic and are not live provider acceptance.
- Build ZIP root manifest, 0.3.2 version, exact supported scripting hosts and license notice verified; archive integrity passed. Source/build files matched canonical and installed folders.
- Build size about 9.18 MB uncompressed. Tokenizer chunks produce a size warning; build succeeds. No optional size-only refactor was undertaken.
- Test tooling cautions: a concurrent build/test run once timed out importing the cloud test module and caused a follow-on mock failure; the complete project suite then passed with two workers, without raising timeouts. An accidental workspace-root test run included unrelated competitor tests and failed due their missing dependencies/environments. Use the application root or the clean validation directory, not the broad reference workspace.

### Live installed Brave checks

- Actual installed version moved from stale 0.2.2 to current 0.3.2 **in build-1**, preserving extension ID/local library. Earlier wrong-folder updates were why the user kept seeing old behavior.
- Google sign-in, explicit approved cloud upload, preview and same-installation restore succeeded. Existing library retained. This is not a second-device restore proof.
- Native Brave sidebar opened, followed Claude/Gemini tab changes, and connected already-open pages without reloading their conversations.
- Claude native settings showed Current session 0% used and All models 0% used. Handoff matched them as separate Session/Weekly 0% used and 100% left. This is one account snapshot, not a general free-tier validation. Weekday-format reset text such as “Resets Sun 12:30 AM” was not converted into a verified countdown.
- Prompt strip hid behind the settings dialog and returned below the composer after closing it.
- Gemini navigation drawer made conversation content inaccessible. Closing the provider drawer exposed it; two-message capture succeeded. Final packaged live review: one copy of original prompt, no speaker chrome, code retained, end of assistant answer and final question retained. No transferred prompt was submitted.

### Not passed / not run

- Complete capture and draft insertion on all six signed-in providers; current long histories/streaming/revised branches/media/artifacts/canvas and failure recovery across layouts.
- Real 80%/95%/reached alerts and real nonzero quotas/reset transitions/account changes across services. Other services without evidence remain unknown.
- Cross-device restore into an empty local library; cancellation, expired/refreshed sessions, browser restart, disconnect, offline behavior, and separate real cloud deletion.
- Keyboard/screen-reader/contrast/reduced-motion acceptance on live browsers; full Chrome/Edge/Firefox support. Current platform is Chromium MV3; do not imply Firefox support without a separate implementation/build.
- Real two-target, three-generation continuation evaluation. No model reply dataset or passing 8/10 quality score exists.
- Google public-app verification/audience/branding, published privacy policy, Chrome Web Store submission/approval, final operator/contact details.

## 7. Prioritized remaining work

Treat this as the continuation backlog, not a claim that all phases are accepted. Preserve the good parts and close one concrete gap at a time.

### Priority 1 — finish trust-critical live workflows

1. Reconnect Handoff's app sign-in if needed, without changing AI accounts or reading their sessions.
2. Test real capture → saved capsule → reopen/edit → full/compact review → destination draft insertion for each enabled provider. Never send automatically. Start with the reported Gemini/DeepSeek to-do examples; compare exact source facts/code/tail/question preservation and absence of sidebar titles.
3. Test already-open tabs after extension update, empty chats versus hidden/blocked content, unavailable receiver recovery, tab navigation while capture is running, cancelled scroll capture, long virtualized windows, repeated prompts and edited branches. Save redacted fixtures with permission; do not commit real private chats.
4. Test second-device/clean-profile restore using synthetic disposable content and scoped user approval. Prove actual recovery, not only merge into a library that already contains everything. Test offline/errors/expiry/cancellation and newer-copy retention. Do not clear the user's real library or delete their backup to manufacture a test.
5. Keep browser/app OAuth secrets out of source and evidence. If secret rotation remains unresolved, ask the human to rotate directly in the dashboard; do not repeat old secrets.

### Priority 2 — usage correctness and unobtrusive display

1. Finish Claude native usage route/layout regression coverage, including weekday/local-time reset text, DST/time zones, and localized labels. Prefer explicit service timestamps where exposed. A missing reset is unknown, not a made-up five-hour timer.
2. Test session/weekly/model/tool buckets separately, remaining count versus percent, zero versus unknown, stale/expired readings, changes between tabs, and manual account changes. Handoff does not identify AI accounts, so cached readings require careful invalidation/refresh disclosure.
3. Verify actual alerts/badges once per threshold/window and no false signals from quoted chat text, Capsule widgets, or another extension's injected meter. Never copy another extension's 0% as native evidence.
4. Verify below-composer placement on all supported sites and narrow windows: typing, voice/attachments/Send, dropdowns and modal overlays. Hide rather than overlap when there is no safe space.
5. Keep usage source/time/confidence visible and understandable. Exact hidden quotas for “all LLMs” are not technically established; document provider-specific support and safe fallback. Do not ship private Claude APIs merely to make a number appear.

### Priority 3 — demonstrate better context continuity

1. Run the existing five-scenario evaluation with two explicitly identified target models and three successive generations: 30 actual target responses. Preserve prompts, dates, model names, scored facts/constraints/provenance, and reviewer judgments. User submits web-chat prompts; do not auto-submit them to satisfy the harness.
2. `evaluation/README.md` describes filenames `responses/target-a/<scenario>-g1.txt` through g3, likewise target-b. Run `npm run eval`; all must reach at least 8/10 after human review for release acceptance. Current status is pending, not zero or a fabricated score.
3. Compare full transcript versus compact brief on long technical conversations. Measure lost facts, omitted questions/code, false decisions, distortion and continuation behavior. Evaluate before adding embeddings/complex summarizers.
4. Improve incremental evidence retention, decision provenance/supersession, open-task merges and artifact versions where tests show failures. Preserve latest required artifacts; explicitly explain/drop old evidence rather than silently truncate.
5. Optional semantic summarization or on-device models are unimplemented possibilities. No paid provider/key dependency should appear without an approved design and privacy/cost disclosure. Supplying one's own API key is a separate explicit feature decision, not permission to harvest credentials.

### Priority 4 — intent routing and novice-friendly UX

1. Audit live unsent-prompt intent recommendations and the automatic suggestion requirement. Current classifier is a tiny baseline; expand a labeled dataset and evaluate held-out cases/mixed intents before making accuracy claims.
2. Validate capacity-aware routing only against fresh, relevant observed quotas; leave unknowns unknown and preserve manual provider choice. Current model/tool windows can constrain different activities differently.
3. Keep the Capsule-style dashboard hierarchy and clear sidebar/Usage/account actions. Avoid reintroducing the earlier overwhelming multi-card form or adding fake Teams counts.
4. Polish empty/error/loading/saved/connected states, saved titles, latest backup time/contents, meaningful button states and compact/full warnings. Old saved user content should not be silently rewritten or deleted.
5. Perform keyboard/focus-trap/Escape/screen-reader checks; test narrow/light/high-contrast/reduced-motion modes. Subtle CSS motion is already used. Three.js/GSAP were optional, not required.
6. Optional Capsule feature expansions (teams, collaboration, cloud history, automatic sync, stronger search) remain unimplemented. Record them explicitly and sequence only after core reliability; new backend/data-sharing work needs a reviewed design and authorization.

### Priority 5 — finish release without publishing prematurely

1. Reconcile historical contradictions across docs. `PHASE_STATUS.md` deliberately keeps old entries under a historical heading; parts of `RESEARCH.md` still contain superseded “not found/no source copied” statements alongside later findings/MIT dashboard adaptation. Current evidence and dated addenda take precedence. Do not blindly trust an old unchecked line or outdated free-tier statement.
2. Keep source, canonical repository, generated build, build-1 installation, source ZIP and build ZIP synchronized after changes. Always verify manifest version and the actual loaded folder in Brave. Source changes alone do not update the user's installed extension.
3. Preserve license notices; update privacy/permissions for every implemented remote feature. The policy URL stays pending until the user publishes it. No push/deploy/store submission without the relevant authorization.
4. Record remaining acceptance gates and summarize what actually ran, what failed, what was fixed, and what requires a live account/tester.

## 8. Research already done and where to continue

Read `RESEARCH.md`, `RESEARCH_2026-10-21.md`, `POSITIONING.md`, `THIRD_PARTY_NOTICES.md`, and the pasted landscape leads if available. Facts were checked on 20–21 October 2026; re-verify changing provider policies/limits before relying on them. Do not claim research covered every extension on the internet or that low ratings prove a particular implementation defect.

- Capsule Infinity: `https://github.com/ahmadiscoding/capsule-infinity-chrome-extension`, inspected commit `85880642c6a4f3f9296b5282c184c47e6f3705cf`. Generic capture, scroll accumulator, local cache, Supabase/Google PKCE reviewed. Some paths use internal provider APIs; those are not adopted here. Public claims of 100% history coverage or lossless compression remain unproven. Its quick popup path and full-conversation path differ; the former can capture page chrome/truncate.
- Claude Monitor: `https://claude-monitor.com/` and `https://github.com/claude-monitor/claude-monitor-browser-extension`, inspected commit `d0d9f4c31d5d2172605b27de67711c85a96b30fa`. Private usage endpoints/reply stream metadata explain its data source; a matching frontend does not provide identical data on every provider. Handoff currently reads native displayed usage instead.
- AIHero: `https://www.aihero.dev/skills-handoff`. Applied durable goal/progress/decisions/uncertainties/next-step/artifact ideas; actual continuation quality still needs measurement.
- Public ctxport, Capsule, extractGptChat and other identified repositories were reviewed. Local reference copies are under `work/references` in the Codex workspace; they are not dependencies of Handoff and their test suites are not Handoff's release gate.
- Brief section 7 verification covered FreshContext, Relay/onrelay.app, Context Relay, Threadport MCP, Claude-Context-Shift, Claude Counter and Capsule Hub. Distinguish advertised features from independent source/live verification; see the dated product entries for exact URLs/licenses/uncertainties.
- C-DIC and BRIEF-Pro were recorded with limited applicability; “What Survives the Handover?” title/link was found but findings were not accessible. Re-read primary papers before citing results; none proves this extension's quality. Do not import paper benchmark numbers into Handoff marketing.
- AI Usage Limit Alerts, AISpend Tracker and the user's landscape were leads. Some store/review pages were not retrievable; undisclosed source cannot be claimed inspected. Verify current first-party source/licensing if adding anything from them.
- Stitch design artifacts: `outputs/stitch-designs`, `work/stitch-*`, `STITCH_UI_UX_BRIEF.md`. API keys are intentionally not in this handoff. Use the original branding and accessibility requirements even when drawing inspiration from Capsule.

## 9. Read order, commands and evidence

### Read order

1. This handoff, `README.md`, `PROJECT_REPORT.md`.
2. `LIVE_VALIDATION_2026-10-21.md`, `VERIFICATION.md`, `REQUIREMENTS_STATUS.md`, `LIVE_SITE_CHECKLIST.md`.
3. `CODEX_BRIEF_v2.md` sections 7–11, treating later user decisions here as the updates to historical design proposals.
4. `CLOUD_SETUP.md`, `GOOGLE_LOGIN_SETUP.md`, `PRIVACY.md`, `STORE_LISTING.md`.
5. Relevant core/entrypoint files and their tests, then `evaluation/README.md`, fixtures/evaluator and research.

### Normal development commands (run inside the application repository)

```sh
npm ci
npm test -- --maxWorkers=2
npm run typecheck
npm run build
npm run eval
```

Use the lockfile; don't upgrade dependencies to resolve unrelated problems without evidence. `npm run eval` remains pending/fails its release gate until actual target replies exist; report that honestly. Existing installed dependencies may already be available, so reinstall only when necessary.

On this Mac, validation used bundled Node at `/Users/oscar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`. The isolated verification scripts `work/verify-capsule-ui.mjs` and `work/verify-content.mjs` use local absolute paths and synthetic Chrome APIs; adapt them deliberately rather than treating their mocks as live tests. They are outside the source archive. Claude with only the archive should use included unit tests and create an appropriate isolated harness if needed.

### Private local evidence (not included in source ZIP)

Under the Codex workspace's `outputs/ui-previews`:

- `package-checks.json`: 0.3.2 packaging/tests and narrow live outcomes.
- `installed-extension-update.json`: actual installed ID/path, saved callback, live auth/backup/restore flags, final Gemini fidelity, final reload/session state.
- `gemini-live-fidelity-032.json`: original prompt occurrences 1; speaker chrome false; final question/code/final feature true.
- `cloud-restored.png`, `google-connected.png`, `installed-handoff-032.png`, `claude-live-usage-032.png`, `claude-live-prompt-032.png`, `gemini-live-capture-032.png`.
- Older `browser-checks.json`/`content-checks.json` and fixture screenshots are isolated testing evidence, not fresh signed-in acceptance on every provider.

These screenshots can include private account/chat information; do not publish them or copy them into public test fixtures.

## 10. Immediate next action for Claude

Confirm you can access the **actual source** and distinguish build-1 from source. Identify the remaining Priority 1 acceptance tasks and reproduce one concrete gap, starting with cross-device recovery using disposable data or the live capture-to-draft matrix. Keep the currently working Google setup, Gemini capture and Claude visible meter intact. Do not spend the first turn rebuilding the frontend or asking the user to restate the project. If a test or account interaction needs the human, prepare the exact reversible test and state the specific missing action.

Completion must mean demonstrated behavior plus updated evidence, not “all phases done” based only on synthetic tests. No superiority, legal safety, universal quota accuracy, or release-ready claim is established yet.
