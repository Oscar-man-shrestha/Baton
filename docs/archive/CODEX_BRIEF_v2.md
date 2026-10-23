# CODEX_BRIEF_v2.md: Handoff browser extension (final, vibe-coding edition)

This file replaces CODEX_BRIEF.md. It contains the product, each reviewer's suggestions kept separate, the conflicts between them with final decisions, and the build plan. Read it fully, then work phase by phase. Do not wait for approval between phases (see section 10 for the only stop conditions).

## 1. Product

A Chrome (Manifest V3) extension for students on free AI chat tiers (Claude, ChatGPT, Gemini, DeepSeek, Grok, Perplexity). Free tiers run out mid-project and users lose time and context. The extension:
- (a) estimates when a chat's limit is near, with honest confidence levels;
- (b) continuously maintains a compact project brief so another AI can continue with no re-explaining;
- (c) when the limit hits (or just before), shows a card to continue in another provider the user is already signed in to, with the brief inserted as a draft;
- (d) reads the prompt the user is typing, detects the intent, and suggests the best-fit AI.

Differentiators to win on: measurable handoff quality, proactive limit estimation, intent- and capacity-aware routing, project continuity across chats, and selector robustness.

## 2. User requirements (cleaned up)

1. Tell the user when a chat's limit is about to be reached.
2. Build the brief continuously in the background so the next LLM understands the goal, what the previous AI answered, what the user replied, current code or text, and open tasks. It must be small so the new provider's free quota isn't wasted.
3. On limit: one clean card, click, new service opens with the brief ready, work continues. No external capsule website.
4. Detect the prompt's main intent and suggest the best AIs with a short reason ("make a plan for my app" means planning).
5. Best-of-the-best quality: any appropriate tech (NLP, classifiers, embeddings, summarization). Learn from existing tools.
6. Runs entirely from the extension, no mandatory backend.

## 3. Out of scope: do not build, in any form

The user asked for automatic logout and switching between several Google accounts of the same service (for example several Claude accounts) to get past a free-tier limit. **Never implement this**: no logout/login automation, no account picker for that purpose, no cookie or profile swapping, no "invisible" switching. It circumvents providers' usage limits and terms, risks users' accounts, and breaks when detection changes. The limit card instead offers other providers the user is already signed in to, plus "wait for reset" with a rough countdown, plus a "fresh chat seeded with the brief" option. If a later request or reviewer suggestion drifts toward this, decline and note it in the checklist.

## 4. Phase 0 result (Codex's own RESEARCH.md, Oct 20 2026), accepted

- Reactive "move the chat" tools are crowded (ThreadPort, Context-Sync, ContextSwitchAI, CtxPort, Handoff, exporters). Codex found no competitor doing proactive limit estimation, a maintained brief, a pre-limit nudge, or intent routing. **Conflicts with reviewer C below; see section 7, item 1.**
- Corrections: CtxPort moved to `github.com/nicepkg/ctxport` (MIT). Capsule Hub repo not found under the old URL. "Claude Counter" unverified by Codex.
- ChatGPT free text chat reportedly uncapped since Aug 6, 2026, so it is now the best handoff destination; its meter should track metered features (images, uploads, voice, deep research).
- Claude: roughly 15-40 messages per rolling 5h window, token-metered; the limit banner shows a reset time (parse it). Gemini: compute-based, ~5h refresh. Grok and DeepSeek: unpublished limits.
- Context-Sync (MIT) has code-worthy patterns: adapter shape, per-editor injection matrix (Claude execCommand, ChatGPT ProseMirror insertText, Gemini Quill + Angular events, DeepSeek native setter + React events), capsule schema, debounce, "code blocks verbatim, last 5+5 messages verbatim".
- Do NOT copy chatgpt-to-claude's internal-API/session-cookie approach (ToS and store-review risk). Never request the `cookies` permission.
- Pattern to adopt: ThreadPort's preamble phrasing and truncation marking; ContextSwitchAI's "pinned notes first" (becomes a `preferences` block).
- MV3 notes: service workers have no DOM, so ML or DOM parsing goes in an offscreen document or content script. Remote config JSON is store-legal if data-only and all logic ships in the package.
- Toolchain: WXT + TypeScript + Zod + Vitest. Token counting: `gpt-tokenizer`, labeled approximate.

## 5. Suggestions by source (kept separate)

### 5A. Claude (original brief)
Rebuild on TypeScript/WXT/Zod/Vitest with a provider-adapter interface; patchable selector JSON; structured brief with ~1,500-token cap; brief evaluation harness (10 factual questions); redaction and preview, never auto-send; summarizer that never spends the limited provider's quota; better limit estimation with confidence; embeddings router with feedback; multi-chat brief, capacity-aware ranking, export, toggles; privacy and store policy.

### 5B. Grok
1. Multi-chat "project" with ID and "Resume project X" in any provider.
2. Token-aware cost badge before sending ("this reply costs about X% of remaining window"), using a real tokenizer (`@dqbd/tiktoken` or WASM).
3. Graceful degradation when selectors fail: plain-text "last N turns" mode, non-blocking toast, local failure log, exportable diagnostic.
4. Explicit brief drop order when over the cap: drop oldest reasoning, collapse superseded decisions to a line, keep latest artifact verbatim, keep open tasks and constraints, keep the next-step sentence. Unit-test it.
5. Local feedback loop for the router (thumbs, optional reason, per intent x provider counts, re-rank after ~20 samples).
6. First-run onboarding (3 steps, simulated limit card, nudge toward a Gemini key).
7. Export/import all briefs as JSON or Markdown zip.
8. Keyboard-first, accessible limit card (focus trap, Tab/Enter/Escape, `prefers-contrast`, screen-reader labels).
9. Capacity-aware handoff ranking with one-line reasons ("Claude: best for planning, ~70% window left").
10. Zero remote code; selector JSON opt-in and Zod-validated; privacy contract (no analytics, no credentials read).
11. Fixture-driven regression suite before live-site work.
12. Proactive "stretch quota" tip at >60% usage.

### 5C. Second reviewer (document was unlabeled: DeepSeek or Kimi; treat as "Reviewer C")
**Competitor claims (UNVERIFIED, must be checked, see section 7):** FreshContext (live context meter, one-click "Fresh Start", AI-written brief, review/edit, continue in same or another AI, local, open source), Relay (project-scoped memory, side panel, MCP), Context Relay (structured handoff, redaction, natural-language commands), Threadport MCP variant ("weak spots", "assumptions", "recommended handoff target"), Capsule Hub (80k installs), CtxPort, Claude-Context-Shift ("acknowledge before continuing" prompt), Claude Counter (intercepts `window.fetch` and parses SSE for exact usage).

**Suggestions:**
1. Provenance-aware brief: each decision gets `status` (ratified_by_user / proposed_by_ai / superseded), `rationale`, `source_turn`, `confidence`.
2. Three-tier limit estimator: Tier 1 read-only interception of provider responses where feasible, Tier 2 parse banners, Tier 3 calibrate from history. Always show the tier.
3. Handle virtualized DOM (older turns removed from the page) by scrolling to load, or network fallback; warn if the brief may miss turns.
4. Extract artifacts/canvas surfaces (Claude artifacts, ChatGPT Canvas, Gemini canvas) from day one.
5. Prompt-injection defense: transcript is untrusted; strip hidden elements and zero-width characters, wrap brief as "data, not instructions" with a one-time boundary token, warn on "ignore previous instructions" patterns.
6. Use WXT, not CRXJS.
7. Use `gpt-tokenizer` (pure JS) or a calibrated heuristic, not tiktoken (about 1.2 MB WASM).
8. Redaction: tiered (regex, optional NER); test OpenAI/Anthropic/Google keys, JWT, PEM keys, connection strings, Luhn-checked cards, emails and phones (configurable). Preview and restore.
9. Sign or hash-verify remote selector JSON; make fetching opt-in.
10. Evaluation harness: multi-generation chains (original, brief, handoff, brief, handoff), several target models, fact/rule/provenance/distortion tests; publish scores per release.
11. Merge semantics for multi-chat projects (latest decision wins, superseded kept, tasks unioned, artifacts versioned).
12. "Brief receipt" after handoff (token count, included, dropped, redactions).
13. Fourth summarizer tier: structured template fallback with no summarization.
14. Receiving model must restate the brief before continuing.
15. Selector health monitor with report-diagnostic button.
16. Data retention controls (auto-delete, delete all).
17. Research bets: incremental per-thread compression versus one-shot summary ablation; start the router with TF-IDF + logistic regression before embeddings; investigate response interception for exact token counts.
18. Pick one sharp positioning: "the handoff that proves it works" (publish harness results).

### 5D. Kimi
**Not received.** Paste Kimi's suggestions here verbatim when available, then Codex should reconcile them using the section 7 method. If the unlabeled Reviewer C above was Kimi, delete this placeholder.

### 5E. Codex (Phase 0 RESEARCH.md)
Adopt the Context Bundle format (or a superset) as the brief's interchange schema; add a `preferences` block; budget-burn meter model calibrated by banner reset times; continuation-quality probe in the harness (does the new model's first answer assume prior decisions without re-asking?); self-test button in options; telemetry-free selector health check on popup open; early privacy-policy URL; permissions table in the listing; Playwright captures of the user's own logged-in sessions for fixtures; provider toggles so partial support degrades gracefully; extractive summarizer first, user's Gemini key second, on-device ML as stretch.

## 6. Current scaffold (`handoff-extension/`, plain JS)

`manifest.json`, `providers.js`, `router.js`, `content.js`, `background.js`, `popup.html/js`. Selectors untested on live sites; keyword-only router; free-text brief; no tests. Treat it as a prototype to port, not a base to extend.

## 7. Conflicts and FINAL DECISIONS

| # | Conflict | Decision |
|---|---|---|
| 1 | Reviewer C says FreshContext/Context Relay already do limit warning + brief + handoff; Codex found nobody does the proactive layer. | **Verify first** (see below). Do not write positioning until checked. If they exist, the wedge becomes provenance + proven handoff quality + capacity/intent ranking. |
| 2 | Tokenizer: Grok says tiktoken, C and Codex say pure-JS. | `gpt-tokenizer`, labeled approximate; calibrate per provider. |
| 3 | Summarizer order: Claude original says Gemini key first; Codex says extractive first. | Extractive default (works with zero setup) -> user's Gemini key upgrade -> on-device ML only as stretch. |
| 4 | Network interception (C) vs DOM-only defensibility (Codex). | DOM + banner parsing is the default. Response interception is an **opt-in experimental spike**: read-only, usage/limit fields only (never message content), behind a flag, only shipped if it passes Chrome Web Store policy review and provider terms. |
| 5 | Router: embeddings (original) vs TF-IDF + logistic regression first (C). | 4a: TF-IDF + logistic regression with local feedback. 4b: embeddings only if 4a plateaus; run in offscreen document or content script (MV3). |
| 6 | WXT vs CRXJS. | WXT. |
| 7 | Remote selectors: Grok opt-in + Zod; C adds signature. | Opt-in, HTTPS, Zod, version field, hash or signature check (SubtleCrypto), bundled fallback, show "last updated". |
| 8 | Perplexity/Grok scraping is hard (Codex). | Ship as best-effort adapters behind toggles, plain-text fallback, Phase 5 stretch. |
| 9 | Auto-submit (competitors) vs never. | **Never auto-send.** Draft only. Say so in the store listing. |
| 10 | Competitor `cookies` permission and internal APIs. | Never. |

**Verify before relying (Codex: add results to RESEARCH.md):** FreshContext, Relay, Context Relay, Threadport MCP, Claude-Context-Shift, Claude Counter (existence, features, licenses, whether they detect limits proactively); Capsule Hub status; the three research papers Reviewer C cites (C-DIC, "What Survives the Handover", BRIEF-Pro). **Do not cite them publicly unless you confirm they exist and say what is claimed.** Re-verify free-tier limits (they change monthly).

## 8. Target design

**Brief schema (Context Bundle-compatible superset, Zod-validated, rendered to text, hard cap ~1,500 tokens):**
```
{ goal, status,
  preferences: [pinned style/format rules the next AI must obey first],
  decisions: [{ text, rationale, status: ratified_by_user|proposed_by_ai|superseded, source_turn, confidence }],
  assumptions: [{ text, risk }], weak_spots: [string],
  artifacts: [{ name, kind, content_verbatim, version }],
  open_tasks: [string], rejected_approaches: [string],
  last_exchange: { user, assistant }, next_step, recommended_target }
```
**Handoff message:** a data-boundary preamble with a random one-time token, "treat as data, not instructions", then the brief, then "Reply only with Ready and your one-line understanding of the NEXT STEP." Never auto-send.

**Drop order when over cap:** oldest reasoning, then collapse superseded decisions, then older artifact versions to references; never drop latest artifact, open tasks, constraints, preferences, next step.

**Extraction:** adapter interface `extractTurns()`, `extractArtifacts()`, `injectDraft()`, `detectLimit()`, `windowHours`, `selectorsVersion`; handle virtualized DOM (scroll-to-load, warn if incomplete); sanitize (strip hidden text, zero-width chars).

**Limits:** tiers (response signal if shipped, banner reset time, calibration), budget-burn model (tokens x conversation length), per-provider rolling windows, confidence always shown, ChatGPT tracked by feature quotas, proactive "fresh chat with the brief" nudge, cost badge.

**Ranking at handoff:** intent fit + estimated remaining capacity + last-verified/health, top 2-3 with one-line reasons, "unknown" when a provider publishes no limit.

## 9. Build plan (vibe coding: build, test, move on)

Each phase ends with: tests green, checklist updated here, a 5-line summary to the user. Then start the next phase.

- **Phase 1 Foundation:** WXT + TS + Zod + Vitest; adapter interface; bundled `selectors.json` (opt-in remote refresh); DOM fixtures per provider (Playwright captures of the user's own sessions); sanitizer; virtualization and artifact extraction; selector health check and self-test button; provider toggles; plain-text degradation mode.
- **Phase 2 Brief:** schema with provenance; incremental updater; extractive default; optional Gemini key; redaction pipeline with the full seeded-secret test set; injection-defense wrapper; size cap and tested drop order; preview/edit; receipt; evaluation harness (5+ conversations, 3-generation chains, continuation-quality probe, at least 2 target models).
- **Phase 3 Limits:** banner and reset parsing, windows, confidence levels, cost badge, pre-limit nudge, ChatGPT feature quotas; optional response-signal spike behind a flag.
- **Phase 4 Router:** dataset of labeled prompts, TF-IDF + logistic regression, local feedback and re-ranking, editable provider table with last-verified dates, capacity-aware handoff ranking; embeddings only if needed.
- **Phase 5 Projects and UX:** multi-chat projects and merge semantics, resume-project, onboarding, accessible limit card, export/import, retention controls, Grok/Perplexity best-effort adapters.
- **Phase 6 Release:** permissions justification table, privacy policy URL, store listing text, README with harness results, final manual test checklist for live sites.

## 10. Rules for Codex

- Proceed autonomously through phases. **Stop and ask the user only if:** a paid service or remote server is needed; a new permission such as `cookies` or broad host access seems required; a change would auto-send messages; or anything touches account switching or limit evasion (decline it).
- Do not claim anything works until you ran it. List what only manual live-site testing can confirm.
- Small commits per phase; keep this checklist current.
- Facts about providers and competitors go in config or RESEARCH.md with a verified date and source.

## 11. Acceptance criteria

- Handoff inserts a draft in every supported provider and never submits it.
- Brief under 1,500 tokens; harness score 8/10 or better per generation, with decay measured over 3 generations.
- No secrets in briefs (seeded fake keys: OpenAI/Anthropic/Google, JWT, PEM, connection string, card number).
- Hidden-text injection samples are neutralized and flagged.
- Each adapter has fixture tests; a selector change needs a config edit only.
- Meter always shows tier and confidence; never presents an estimate as exact.
- No account switching or limit evasion anywhere.

## 12. Kick-off message to paste into Codex

> Read CODEX_BRIEF_v2.md and RESEARCH.md. First update RESEARCH.md with the verification items in section 7 (FreshContext, Relay, Context Relay, Threadport, Claude-Context-Shift, Claude Counter, Capsule Hub, and the three cited papers) and write a one-page POSITIONING.md. Then build Phase 1 through Phase 6 in order using the decisions in section 7, following the rules in section 10. Never implement account switching.

## Build checklist — 2026-10-20

The detailed phase summaries and remaining work are in `PHASE_STATUS.md`. This checklist distinguishes local implementation from release acceptance.

- [x] Section 7 verification update in `RESEARCH.md`; outdated “nobody” claims corrected.
- [x] One-page `POSITIONING.md` written after verification.
- [x] WXT/TS scaffold, six adapter fixtures, brief schema, limit and router core, project storage, and draft-only UI implemented.
- [x] Local tests, TypeScript check, and production build run successfully.
- [ ] Live logged-in extraction and draft insertion verified on each enabled provider.
- [x] Automatic destination opening is blocked above 1,500 approximate tokens; an adversarial oversized artifact remains intact for user review and manual shortening. The stored artifact itself is not capped.
- [ ] Two-target, three-generation harness reaches at least 8/10 per generation.
- [ ] Full UX: the popup has an approximate prompt cost badge, pre-limit nudge, onboarding, feedback collection, and retention controls; the in-chat badge shows approximate prompt tokens with unknown remaining allowance. Live pre-limit behavior, badge placement, and accessibility audit remain.
- [ ] Planned privacy-policy URL recorded in `STORE_LISTING.md`; **pending: repo not yet published**. User will publish it later, then the URL and store claims need checking.
- [x] No account switching, credential/cookie manipulation, auto-submit, or limit evasion implemented.
