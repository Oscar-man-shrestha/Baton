# Phase status — 2026-10-20

These are implementation summaries, not release claims. The updated source was verified in a clean temporary checkout: `npm test` 17/17 passed, TypeScript check passed, and WXT production build succeeded. Logged-in live-site tests have **not** run.

## Phase 1 — Foundation: partial

- WXT, TypeScript, Zod, Vitest, six narrow site patterns, adapter interface, bundled selectors, and local selector diagnostics exist.
- Synthetic fixtures cover six adapters; hidden attributes and zero-width text are stripped.
- Remote JSON refresh is opt-in infrastructure with HTTPS, schema, version, and SHA-256 validation, but no user flow or signature trust chain is shipped.
- Virtualized older turns are warned about when extraction fails; scrolling recovery and real artifact/canvas extraction remain unverified.
- Local tests pass; user-session Playwright captures were unavailable.

## Phase 2 — Brief: partial

- Structured brief, provenance fields, incremental local updates, redaction, review editor, receipt, and one-time data boundary are implemented.
- Seeded fake key classes and budget-drop behavior have tests; a huge required artifact can still exceed 1,500 approximate tokens and is flagged for manual shortening.
- Optional Gemini-key summarization is omitted because this request rules out credential manipulation. Extractive logic is the only summarizer.
- Five-scenario evaluation harness is ready, but no target model responses have been run; 8/10 quality is unproven.
- Local tests pass; continuation quality and privacy need manual review.

## Phase 3 — Limits: partial

- Visible banner/reset parsing, honest tiers/confidence, history estimate, and ChatGPT feature distinction exist in core logic.
- Popup reports tier and confidence. A keyboard-operable card now appears for visible provider limit notices. The cost badge and calibrated pre-limit nudge are core functions but are not yet surfaced in the chat.
- No response interception is shipped; it would touch sensitive provider internals and is outside this build.
- No numeric cap is asserted for services without one.
- Parser and no-evidence behavior pass local tests; real banners need live testing.

## Phase 4 — Router: partial

- Small labeled prompt set trains a local TF-IDF logistic classifier. Core ranking includes intent, estimated capacity, and local feedback after 20 samples.
- UI suggests a destination based on intent. Provider table includes dated verification or “unverified.”
- The popup collects useful/not-useful feedback locally; re-ranking begins after 20 samples for an intent/provider pair. Editable fit weights are not exposed and the dataset is too small for a quality claim.
- Embeddings were not attempted because the baseline has not been evaluated as plateaued.
- Local classifier smoke test passes; accuracy is unmeasured.

## Phase 5 — Projects and UX: partial

- Named projects, merge behavior, resume copy, JSON export/import, delete-all, high-contrast styling, and draft-only transfer are present.
- Grok and Perplexity adapters are synthetic best-effort, disabled in ranking by default.
- The requested accessible limit card and three-step onboarding are not implemented.
- Project merge unit test passes; live accessibility and destination tests remain.
- No account switching or limit evasion exists.

## Phase 6 — Release: prepared, not ready

- README, privacy-policy draft, store listing draft, permissions rationale, and manual test checklist are included.
- Stable public privacy-policy URL is pending; no remote publication was authorized or performed.
- Evaluation target replies and logged-in site tests are pending.
- Store submission must wait for the checklist and quality threshold.
- The local build succeeded; publication readiness has not been established.
