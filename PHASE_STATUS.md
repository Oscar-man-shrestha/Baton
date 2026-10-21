# Phase status — 2026-10-21

These are implementation summaries, not release claims. The updated source was verified locally: `npm test` 56/56 passed, TypeScript check passed, and WXT production build succeeded. Logged-in live-site tests have **not** run; an isolated headless Brave screenshot attempt did not return a render.

## Phase 1 — Foundation: partial

- WXT, TypeScript, Zod, Vitest, six narrow site patterns, adapter interface, bundled selectors, and local selector diagnostics exist.
- Synthetic fixtures cover six adapters, including user/assistant role checks and code-block formatting; a reported DeepSeek → ChatGPT to-do-app failure now has an end-to-end regression fixture. Hidden attributes, CSS-hidden text, and zero-width text are stripped. Instruction-like hidden text now raises a visible capture warning.
- Remote JSON refresh is opt-in infrastructure with HTTPS, schema, version, and SHA-256 validation, but no user flow or signature trust chain is shipped.
- The content script now accumulates overlapping rendered turn windows into a bounded local transcript for each chat URL. It flags windows without overlap and truncation, and the popup can copy saved text. This does not guarantee capture of messages never rendered or media. The popup warns when a chat shows fewer turns than Handoff previously saw for that URL. An opt-in older-message pass now scrolls a detected conversation container, merges overlapping visible windows, and restores the starting position. It is bounded to 24 steps, remains best effort, and requires logged-in site verification. DeepSeek capture now prefers top-level chat turns, excludes sidebars, recognizes rendered user and assistant roles, and refuses an assistant-only transfer. Existing unversioned transcript archives are rebuilt with selector bundle v2. Real artifact/canvas extraction remains unverified.
- Capture sends counts, a brief, and a usage signal to the popup rather than the full raw turn list; this reduces internal message size for long chats. The brief itself can still be large when a required artifact is large, and no live stress test has been run.
- Local tests pass; user-session Playwright captures were unavailable.

## Phase 2 — Brief: partial

- Structured brief, provenance fields, incremental local updates, redaction, readable text rendering, review editor, receipt, and one-time data boundary are implemented. The handoff now preserves unanswered questions and asks the destination to continue naturally, rather than reply only “Ready.”
- Seeded fake key classes and budget-drop behavior have tests. A huge required artifact remains intact, but the popup blocks opening a destination until the reviewed whole draft fits 1,500 approximate tokens; a user can shorten it manually. The hard cap therefore applies to automatic transfer, not to stored source artifacts.
- Optional Gemini-key summarization is omitted because this request rules out credential manipulation. Extractive logic is the only summarizer.
- Five-scenario evaluation harness is ready. A local check confirms the briefs preserve all listed fixture facts before handoff, but no target model responses have been run; 8/10 continuation quality is unproven.
- Local tests pass; continuation quality and privacy need manual review.

## Phase 3 — Limits: partial

- Visible banner/reset parsing, honest tiers/confidence, history estimate, and ChatGPT feature distinction exist. Reached-limit notices now record only a timestamp and approximate token count locally; after two events, the current chat can be compared with past limit chats. This is not an allowance estimate.
- Popup reports tier, confidence, and a local-time approximate reset when a visible notice supplies one. The popup also shows an approximate token count for the unsent prompt and a historical reply-size comparison. A small, noninteractive status line now appears below the composer while typing or when a visible balance is present, provided there is space; it hides if it would sit over an input control. It shows approximate prompt tokens; a remaining percentage or token balance appears only when a visible service notice explicitly provides it. This replaces the earlier overlapping badge. Real provider notices still need live review.
- No response interception is shipped; it would touch sensitive provider internals and is outside this build.
- No numeric cap is asserted for services without one.
- A collapsed six-service usage view and opt-in desktop notifications now use only service notices visible on pages the user opens. Numeric alerts fire at 80% and 95% used when a displayed percentage supports them; reported near/reached notices can alert without a numeric claim. Optional notification permission is requested when enabled. Cached balances expire from the UI after one hour. This has synthetic parser and alert tests but no signed-in notification test.
- Parser and no-evidence behavior pass local tests; real banners need live testing.

## Phase 4 — Router: partial

- Small labeled prompt set trains a local TF-IDF logistic classifier. Ranking includes intent, directly visible destination limit notices when available, and local feedback after 20 samples; local-history comparisons never count as provider capacity.
- UI suggests a destination based on intent. The options page lets users edit each provider's suggested task types and enabled state; the table includes dated verification or “unverified.”
- The popup collects useful/not-useful feedback locally; re-ranking begins after 20 samples for an intent/provider pair. Task-fit choices are editable, but numeric weights are fixed and the dataset is too small for a quality claim.
- Embeddings were not attempted because the baseline has not been evaluated as plateaued.
- Local classifier smoke test passes; accuracy is unmeasured.

## Phase 5 — Projects and UX: partial

- Named projects, merge behavior, recent-project reopening in the popup, name search and individual delete in settings, readable resume copy, JSON export/import, delete-all, 7/30/90-day local expiry, and draft-only transfer are present. The popup starts with a single capture action, then reveals review and destination controls. Project saving, capture details, and suggestion feedback are optional disclosures. Opening a destination requires the user to open the draft review first. Popup and settings have dark/high-contrast styles, reduced-motion support, subtle motion, and disabled states that match the workflow. Destination insertion verifies the editor again after 400 ms, retries for up to nine seconds, and records a local success/failure diagnostic without saving the draft text in that diagnostic.
- Grok and Perplexity adapters are synthetic best-effort, disabled in ranking by default.
- The revised popup still needs live keyboard and screen-reader review. The content script inserts only a noninteractive status line below a composer when room permits and never takes focus. Its placement still needs live review on each provider.
- Project merge and expiry unit tests pass; editor fixtures verify insertion without a submit event. Static UI checks verify labels, unique IDs, named buttons, and focus/contrast styles. Visual browser, screen-reader, and destination tests remain.
- A Gemini shortcut opens Google’s own site for manual account choice. The extension does not select accounts, touch credentials/cookies, or offer limit evasion.

## Phase 6 — Release: prepared, not ready

- README, privacy-policy draft, store listing draft, permissions rationale, manual test checklist, and a chat-text-free diagnostic export are included.
- The planned privacy-policy URL is in the store listing: https://github.com/Oscar-man-shrestha/handoff-extension/blob/main/PRIVACY.md. **Pending: repo not yet published.** The user will create and push it; no remote publication or hosting was performed here.
- Evaluation target replies and logged-in site tests are pending.
- Store submission must wait for the checklist and quality threshold.
- The local build succeeded; publication readiness has not been established.
