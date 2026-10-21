# RESEARCH.md — Phase 0: Market & Technical Research
**Date:** 2026-10-20 · **Scope:** existing tools, free-tier landscape, toolchain, store policy, reuse decisions
**Companion doc:** `CODEX_BRIEF_v2.md`. The dated verification below supersedes conflicting claims in the original Phase 0 notes.

## User-reported capture comparison — 2026-10-21

A user-provided DeepSeek to-do-app conversation showed Handoff sending only a cut-off assistant reply while omitting the original user goal, after which ChatGPT replied “Ready” as instructed by Handoff’s old wrapper. The user-provided Capsule Infinity capture included many unrelated sidebar chat titles before the active to-do-app text. These are **observed examples supplied by the user**, not controlled comparative tests. The [Capsule Infinity DeepSeek DOM path](https://github.com/ahmadiscoding/capsule-infinity-chrome-extension/blob/85880642c6a4f3f9296b5282c184c47e6f3705cf/source/content-scripts/generic.js) uses `.ds-message` and `.ds-markdown` to distinguish visible turns. Handoff now uses those signals, scopes capture to the active chat, rejects assistant-only captures, keeps unanswered questions in the brief, and removes its “Ready” instruction. A synthetic regression reproduces this failure pattern; live DeepSeek and ChatGPT retesting remains pending.

## Implementation research update — 2026-10-21

- **Capsule Infinity code review:** The [public repository](https://github.com/ahmadiscoding/capsule-infinity-chrome-extension), checked 2026-10-21, advertises full capture, scrolling, fingerprint caching, server compression, and optional cloud sync. The pinned [accumulator source](https://github.com/ahmadiscoding/capsule-infinity-chrome-extension/blob/85880642c6a4f3f9296b5282c184c47e6f3705cf/source/content-scripts/accumulator.js) implements overlapping rendered-window capture and scroll restoration. The [generic content script](https://github.com/ahmadiscoding/capsule-infinity-chrome-extension/blob/85880642c6a4f3f9296b5282c184c47e6f3705cf/source/content-scripts/generic.js) injects controls near page content. **Verified:** these mechanisms exist in source. **Unverified:** 100% history coverage, zero missing technical details after compression, and comparative continuation quality on live sites. Handoff now accumulates rendered text locally, offers a separate compact brief, and keeps its page status outside the editor when space permits. No Capsule Infinity source was copied into Handoff.
- **Free-tier evidence:** [OpenAI Help](https://help.openai.com/en/articles/20001354-gpt-6-and-other-models-in-chatgpt), checked 2026-10-21, says everyday Free/Go text chats are unlimited subject to abuse safeguards, with separate feature limits. [Claude Help](https://support.claude.com/en/articles/8114491-get-started-with-claude), checked 2026-10-21, says Free usage resets every five hours and the message count varies. Those sources do not provide a per-account remaining percentage or token balance for an extension to calculate from prompt text. Handoff now displays a numeric balance only when a visible service notice states it. Its prompt token number is an approximate input count, **not** remaining free-tier tokens. Local comparisons to past limit chats never influence the route as if they were account capacity.
- **Google account choice:** [Google Account Help](https://support.google.com/accounts/answer/1721977?hl=en), checked 2026-10-21, directs users to their profile menu to select another signed-in account. Handoff can open Gemini and explain that manual step. It cannot infer or guarantee account standing, sign-in safety, or account-specific quotas; it reads no credentials, cookies, or Google account identifiers. This is navigation help, not a quota workaround.
- **Product decision:** The extension's differentiator is a local, reviewable capture and brief with explicit completeness and quota uncertainty. The prompt status line hides if there is no safe space below the composer. Live site validation remains necessary before calling the release ready.

## Verification update — 2026-10-20

**Evidence standard.** “Verified” below means the linked primary source currently says it; it does not mean we reproduced the feature in a logged-in browser. Store descriptions and vendor sites are product claims. Search absence cannot establish that a product or feature does not exist. Earlier claims that *nobody* offers a context meter, compact handoff, or project memory are withdrawn.

### Products requested in brief §7

- **Capsule Infinity — verified public product and source, behavior claims not independently reproduced.** Its [Chrome Web Store listing](https://chromewebstore.google.com/detail/capsule-infinity/ilbjnlkgdmkmeodhjhgpniiomfcpklai), checked 2026-10-20, describes user-selected text capture, reusable context capsules, local storage or optional account sync, and use across ChatGPT, Claude, Gemini, and DeepSeek. The developer's [public repository README](https://github.com/ahmadiscoding/capsule-infinity-chrome-extension) says its content script reads conversation DOM, can scroll dynamic chats before capture, deduplicates by a conversation fingerprint, chunks large messages, and sends transcripts to a server-side AI compression service; its [privacy policy](https://github.com/ahmadiscoding/capsule-infinity-chrome-extension/blob/main/PRIVACY_POLICY.md) says capture is triggered by the user and describes optional Supabase sync plus server-side Gemini/Groq processing. These are first-party descriptions, not a logged-in verification of completeness, privacy, or the advertised compression fidelity. Useful ideas for Handoff are a clear capture → review → reuse path and avoiding UI over the prompt editor. Handoff continues to use local, extractive briefs; no account sync, server compression, credential handling, or auto-submit is adopted.

  **Source audit, 2026-10-20.** I also read public source at commit [`8588064`](https://github.com/ahmadiscoding/capsule-infinity-chrome-extension/tree/85880642c6a4f3f9296b5282c184c47e6f3705cf). Its [DOM accumulator](https://github.com/ahmadiscoding/capsule-infinity-chrome-extension/blob/85880642c6a4f3f9296b5282c184c47e6f3705cf/source/content-scripts/accumulator.js) merges overlapping message windows while scrolling upward and restores the original scroll position in `finally`; it caps attempts at 120. Its [generic content script](https://github.com/ahmadiscoding/capsule-infinity-chrome-extension/blob/85880642c6a4f3f9296b5282c184c47e6f3705cf/source/content-scripts/generic.js) inserts capture and capsule controls into provider pages, including near the editor. Its [popup quick action](https://github.com/ahmadiscoding/capsule-infinity-chrome-extension/blob/85880642c6a4f3f9296b5282c184c47e6f3705cf/source/popup/popup.js) uses selected text or the first 3,000 characters of page text, which can include unrelated UI; this differs from its full-conversation path. The [manifest](https://github.com/ahmadiscoding/capsule-infinity-chrome-extension/blob/85880642c6a4f3f9296b5282c184c47e6f3705cf/source/manifest.json) requests broad site, identity, and scripting permissions for those features. Source review confirms the mechanisms are implemented, but not the README's 100% history-coverage or compression-fidelity claims. Handoff adds an opt-in, bounded older-message pass, restores scroll position, keeps controls in the popup, and restricts capture to known chat turn selectors. Live behavior remains to be tested.

- **FreshContext — verified product and advertised overlap.** Its [Chrome Web Store listing](https://chromewebstore.google.com/detail/freshcontext/hggdbdifeefhpklgngdfajlloipbldki), checked 2026-10-20, advertises a live *context-window* meter with warnings, AI-written editable handoff, same-provider or cross-provider fresh start, and local processing for ChatGPT, Claude, and Gemini. It also advertises moving after a *quota* limit. Context-window fullness and account usage quota are distinct; the listing does not establish a proactive account-quota forecast or continuously maintained brief. The linked [source repository](https://github.com/shivam0897-i/freshcontext) states MIT in its privacy policy; code and live behavior need independent audit.
- **Relay (onrelay.app) — verified product and advertised project memory.** [First-party documentation](https://www.onrelay.app/docs/getting-started), checked 2026-10-20, describes project-scoped memory, a Chrome side panel, automatic chat capture, and optional MCP sync. This undercuts the earlier “no cross-chat project brief” assertion. Its public documentation does not establish proactive quota forecasting or draft handoff. Do not confuse it with other products named Relay.
- **Context Relay — verified marketing site, feature details partly unverified.** [context-relay.com](https://context-relay.com/), checked 2026-10-20, claims structured bundles of decisions, constraints, progress, and intent for cross-model continuation. I found no primary evidence on that site for proactive limit warning, built-in redaction, or natural-language commands. Several unrelated products share the name; [contextrelay.dev](https://www.contextrelay.dev/) is an agent payload relay, not this browser workflow.
- **Threadport MCP variant — verified separate product.** [threadport.vercel.app](https://threadport.vercel.app/), checked 2026-10-20, advertises a Chrome capture tool plus local MCP server and capsules with assumptions, weak spots, next actions, and a recommended target. This is distinct from the [ThreadPort browser transfer extension](https://chromewebstore.google.com/search/ThreadPort). The MCP site claims local LLM compression; neither quota forecasting nor its “0% lost” marketing claim has been independently validated.
- **Claude-Context-Shift — partially verified.** The [creator's September 2026 post](https://www.reddit.com/r/BuildWithClaude/comments/1w4lrid/built_a_way_to_stop_re_explaining_context_every/) describes an open-source extension moving Claude context into Cursor and other tools. I could not establish the repository, license text, exact features, “acknowledge before continuing” prompt, or proactive limit detection from a primary code source. Treat those claims as unverified.
- **Claude Counter — verified source, but unsuitable architecture here.** The [MIT repository](https://github.com/she-llac/claude-counter), checked 2026-10-20, says it intercepts Claude responses, reads `/usage` and SSE `message_limit`, and displays session/weekly bars and reset countdowns. Its conversation token count is approximate. It also says it reads a cookie to query usage, so its method conflicts with this project's no-cookie/no-credential boundary. It proves usage signals may exist, not that this extension should adopt its mechanism.
- **Capsule Hub — verified current store presence.** The [Chrome Web Store listing](https://chromewebstore.google.com/detail/capsule-hub-by-tilantra/ngeoeefidomejcdhiecidpaalfoekjbh), checked 2026-10-20, shows **100,000 users** and describes reusable capsules across AI tools. The earlier 80,000 figure is stale. The [vendor site](https://capsulehub.tilantra.com/) describes extension and MCP workflows. I did not verify open-source licensing, local-only operation, or proactive quota prediction.

### Three papers requested in brief §7

- **C-DIC — verified.** Jung et al., [“Context-Driven Incremental Compression for Multi-Turn Dialogue Generation”](https://arxiv.org/abs/2606.12411), arXiv posted 2026-06-10, proposes revisable per-thread compressed dialogue memory and reports stable latency/perplexity over long dialogue. This supports testing incremental updates against one-shot summaries; it does **not** validate this extension's extractive algorithm or its quality threshold.
- **“What Survives the Handover?” — title and DOI link verified; findings unverified.** [Prioquity's research index](https://www.prioquity.com/weather.html), checked 2026-10-20, links this title to [DOI 10.5281/zenodo.22131393](https://doi.org/10.5281/zenodo.22131393). The repository text was inaccessible through the research browser, so no numeric result or methodological claim is adopted. Provenance evaluation remains a design hypothesis.
- **BRIEF-Pro — verified, scope limited.** Gu et al., [“BRIEF-Pro: Universal Context Compression with Short-to-Long Synthesis for Fast and Accurate Multi-Hop Reasoning”](https://arxiv.org/abs/2510.13799), 2025-10-15 preprint; [authors' project page](https://gujc.me/BRIEF/) reports 32× compression on multi-hop retrieval QA. It compresses retrieved evidence for question answering, not cross-provider conversational handoffs. Its results cannot be quoted as expected handoff quality.

### Current provider limits and implications

- [OpenAI Help](https://help.openai.com/en/articles/20001354-gpt-6-and-other-models-in-chatgpt), checked 2026-10-20, says Free/Go everyday text chats are unlimited subject to abuse safeguards, while uploads, images, voice and other tools have separate limits. The previous “uncapped since Aug 6” start date was not confirmed by this source; omit the date from product copy.
- [Claude Help](https://support.claude.com/en/articles/8114491-get-started-with-claude), checked 2026-10-20, says Free has a session limit resetting every five hours and message count varies with demand. The earlier “15–40 messages” figure is not official and must not drive a fixed meter. [Claude's limits explanation](https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work) distinguishes usage limits from context length.
- [Gemini Help](https://support.google.com/gemini/answer/16275805?hl=en), checked 2026-10-20, says usage is compute-based, varies with complexity/features/chat length, refreshes every five hours until weekly limits, and can change without notice. Its free consumer limits must not be conflated with Gemini API limits.
- [Perplexity Help](https://www.perplexity.ai/help-center/en/articles/11187416-which-perplexity-subscription-plan-is-right-for-you), checked 2026-10-20, describes practically unlimited basic searches and very limited Pro searches, without a numeric count. Grok and DeepSeek consumer quotas remain **unverified** from first-party sources in this pass; display “unknown.”

**Positioning consequence.** Compete on independently measured continuation quality, provenance, local privacy, honest quota uncertainty, and useful destination recommendations. Do not claim first mover status for a meter, brief, or project memory. Research and store text must distinguish context-window warnings from provider usage quotas.

---

## 1. Executive summary

- The **reactive transfer** niche (move a chat after you decide to) is crowded: ThreadPort,
  Context-Sync, ContextSwitchAI, CtxPort, Handoff, Chat Transfer, plus a dozen exporters.
- **Correction:** the later verification update above found overlapping context meters, handoff briefs,
  and project memory. A proactive usage-quota forecast tied to a measured handoff remains a hypothesis
  for positioning, not an established empty market.
- All competitors share the same fragility: untested/hard-coded DOM selectors, no fixture tests,
  silent breakage on site redesigns. The selector-refresh + fixture-test architecture in the brief
  is a real moat, not just hygiene.
- Key corrections to the brief's section 4: **CtxPort moved** from `sonymas/ctxport` to
  `nicepkg/ctxport`; "Claude Counter" could not be verified under that name (treat as unverified);
  ChatGPT's free tier **removed its text-message cap on Aug 6, 2026**, which reshapes the
  limit-estimation feature (see §3).

---

## 2. Competitor matrix (verified Oct 2026)

| Tool | Where | Scraping approach | Injection | Context format | Long-chat handling | Weaknesses / what breaks | License | Reuse |
|---|---|---|---|---|---|---|---|---|
| **ThreadPort** (store; source "publicly viewable") | Chrome/Edge store, Aug 2026 reviews (TechRadar, Tom's Guide) | Reads current chat DOM on click | Full transcript into destination prompt box; optional auto-submit | "Prompt + transcript" with origin preamble ("You are continuing a conversation that started on ChatGPT…"); strips UI debris | "Smart truncation": keeps original task + most recent exchanges, marks removable section | Closed core; no limit detection; no brief/summary; images/files not carried; free plan = 10 transfers/mo (premium planned) | Source-viewable, not clearly OSS | **Idea**: preamble phrasing proven to make target model "pick up naturally" (quoted in Tom's Guide). Truncation marking idea. |
| **Context-Sync** (Vineetpandey0) | GitHub, MIT | Per-site content scripts, MutationObserver + 1.5s debounce. Known-good selectors: Claude `[data-testid="user-message"]` + `.font-claude-response`; ChatGPT `[data-message-author-role]`; Gemini `user-query-content`/`model-response` (Angular); DeepSeek per-site | **Per-editor strategies**: Claude `execCommand`; ChatGPT ProseMirror `insertText`; Gemini Quill `innerHTML` + full Angular event chain, triple-fire (0/1.5/3s); DeepSeek native textarea setter + React synthetic events. Auto-submits | JSON capsule (id/title/url/source/version/messages[]); plain-text copy; optional Gemini 2.5 Flash compression: **code blocks extracted & never compressed**, last 5 user + 5 assistant msgs kept verbatim, shorter msgs skipped | Keeps last 5+5; code always verbatim | Auto-submit by default (trust risk); Gemini injection brittle by design; only 4 providers; `chrome.storage.local` 5MB / 50 convos cap | **MIT** | **Code-worthy**: adapter interface shape, injection matrix, capsule schema, debounce pattern. |
| **CtxPort** (now **nicepkg/ctxport**) | GitHub | Sidebar list copy without opening chat; per-platform adapter plugins | Copies as Markdown "Context Bundle" | Zod-schematized **Context Bundle** format + Markdown serialization engine | Formats designed for LLM re-ingestion | Copy-out only (no inject); no limits/brief logic | **MIT** (monorepo: core-schema / core-plugins / core-markdown) | **Adopt the Context Bundle schema idea** as the brief's interchange format — interop with an existing OSS standard beats inventing one. |
| **chatgpt-to-claude** (midweste) | GitHub, MIT | **Not DOM scraping**: calls ChatGPT's internal `/backend-api/*` endpoints with the user's session cookies (via `chrome.cookies` in service worker) | Pushes into Claude using existing sessions; rate-limit-aware queue, auto-pause on 429 | Full fidelity incl. memories, custom instructions, project mapping | Dashboard browse/filter; ZIP export | **ToS risk**: OpenAI ToU prohibits automated data extraction (their own docs note this); breaks silently when endpoints change; needs `cookies` permission (store-review friction) | **MIT** | **Ideas only**: push-tracking/dedup, 429-aware queue, sender verification, IndexedDB storage, 340 Vitest tests. **Do NOT copy the internal-API approach** — DOM scraping of the user's own rendered page is the defensible pattern every competitor uses. |
| **ContextSwitchAI** | Chrome Web Store + site, v2.0 Mar 2026 | DOM capture on Export click | Auto-attaches JSON memory file to new AI tab; opening message auto-submits | Proprietary **CCMF JSON** (~70% smaller claim), MD, PDF; **notes injected first** (style rules) | Selective export | No limit logic; auto-submit; format is proprietary, not open | Freeware, not open source | **Idea**: "pin notes the next AI must see first" (style rules) — worth adding to the brief schema as a `preferences` block. |
| **Handoff — AI Chat Context Transfer** | Chrome Web Store, ~152 users | Unknown | One-click transfer ChatGPT/Claude/Grok/Gemini | Unknown | Unknown | **Requests `cookies` permission for a transfer tool** — a store-trust red flag and review liability; no ratings | Closed | Anti-pattern example: never request `cookies`. |
| **Context Bridge / Chat Transfer / Capsule Hub** | Store / GitHub | Could not verify live in this pass (Capsule Hub repo not found under the given name; treat brief's notes as unverified) | — | — | — | — | — | Re-verify before Phase 2 if needed. |
| **Exporters** (chat-exporter-ext, Backrun, SaveAI, XWX, Chat Export & Navigator) | Store/GitHub | DOM scrape → clipboard/file | None (no continue) | Markdown/JSON/PDF/Notion | Timestamps, model badges, YAML frontmatter (XWX — Obsidian/Logseq angle) | No continuation at all | Mostly MIT | **Idea**: Markdown export of the brief (XWX's metadata-rich MD is the model). |

**Updated assessment:** product claims overlap substantially; continuation quality and provider-limit behavior need independent comparative testing.

---

## 3. Free-tier limit landscape — verified Oct 2026 (all facts date-stamped, keep in editable config)

| Provider | Free limit (as published/observed, Oct 2026) | Reset mechanics | Implication for our meter |
|---|---|---|---|
| **ChatGPT** | **Text chats effectively uncapped since Aug 6, 2026** (abuse-prevention only); free model GPT-6 Luna (rolled out Oct 8, 2026). Still metered: uploads, images (~2–3/day), voice, deep research, Codex/Work | Reset times shown in app for metered features | Meter for ChatGPT should track **feature quotas**, not messages. Handoff *from* Claude *to* ChatGPT is the highest-value route. |
| **Claude** | **~15–40 messages per rolling 5-hour window** (observed; Anthropic publishes no number — token-metered). Long chats burn fast because every turn re-reads history; paid limits doubled May 6, 2026 | Rolling 5h from first message; **limit banner shows estimated reset time** — parse it | Primary target for estimation. Cost model: per-turn tokens × conversation length. Banner = ground-truth calibration signal. |
| **Gemini** | No published cap; **compute-based limits refreshing on ~5h cycle**; free API tier (AI Studio): 10 RPM / 250k TPM / 1,500 req/day | 5h refresh; weekly cap shifts you to smaller models | Estimate = weakest confidence; show "calibrating" longest here. Free API quota makes it the natural summarizer backend. |
| **Grok** | xAI retired the "10 prompts / 2h" figure in **June 2026**; now an unpublished Chat/Voice allowance; check Settings > Usage; paid renamed "The X Subscription" Oct 12, 2026 | Own reset cycle, unpublished | Meter must learn purely from observed limit events; low confidence always. |
| **DeepSeek** | No published cap; fair-use throttling at peak | Unpublished | Same as Grok. |
| **Perplexity** | Freemium with daily Pro searches; chat largely usable | — | Not researched deeply; scraping is hardest here (React, obfuscated classes). Treat as Phase-4 stretch. |
| **Copilot / Meta AI** | No published consumer caps | — | Possible future handoff targets (ContextSwitchAI already ships 9 platforms). |

Sources: Tech Insider free-tier comparison (Sep 1, 2026), heyuan110/aittoolsrecap Claude guides (Jul–Apr 2026),
justinmckelvey usage-limits tracker (Oct 12, 2026), felloai Grok guide (updated Oct 19, 2026).

---

## 4. Technical findings

### 4.1 Toolchain (2026 state)
- **WXT is the consensus default** for new production extensions in 2026: file-based entrypoints,
  cross-browser (incl. Safari), built-in typed storage, Vitest plugin with fake-browser, `wxt submit`.
  Pin the version (0.x; Node 22 floor since 0.21). CRXJS is the "Vite teams wanting control" pick —
  Chrome/Edge only, smaller maintenance team, community-maintained. Plasmo is Parcel-based with
  slower 2026 maintenance. **Recommendation: WXT + TypeScript + Zod + Vitest** (matches the brief;
  CtxPort already proves this stack for exactly this product type).

### 4.2 MV3 hard constraints that shape the design
- **Service workers have no DOM.** Any HTML parsing, canvas, or (practically) WASM/ML inference
  must run in an **offscreen document** or the content script. This directly affects the
  embeddings router (MiniLM) and any WebLLM fallback: budget for an offscreen document with
  `reason: DOM_PARSER` / worker offload, and expect WebGPU to be unavailable in the service worker.
- **Remote config JSON is explicitly store-legal.** Chrome policy permits "fetching a remote
  configuration file … where all logic for the functionality is contained within the extension
  package." Data-only, Zod-validated selector bundles are compliant; ship bundled fallback and
  validate with a version + (optionally) a signature/hash. Never fetch executable code.
- **Permissions are cross-checked against code at review.** Handoff (competitor) requests `cookies`
  for no good reason — don't. Declare only `storage`, `activeTab`, `scripting`, `tabs`,
  `downloads` (if exporting), and per-provider host permissions with written justifications.

### 4.3 Token counting in the browser
- `gpt-tokenizer` (pure JS, ~50KB, fastest for short texts, `encodeChat`) or `js-tiktoken` work
  everywhere including MV3 without WASM headaches.
- **There is no open-source Claude tokenizer.** Anthropic's `countTokens` API endpoint is free but
  needs an API key. Practical approach: count with `o200k_base`, label the meter "approximate,"
  and calibrate per-provider with observed limit events (which the brief already plans).

### 4.4 Summarization without quota
- Context-Sync's extractive rules are a strong free baseline worth copying as the default:
  **code verbatim always**, recent turns verbatim, middle compressed, tiny messages untouched.
- Gemini Flash via the user's own free AI Studio key (10 RPM / 1,500 req/day) is comfortably
  sufficient for background incremental brief updates (a few calls per chat hour).
- WebLLM in MV3 = model download + offscreen + WebGPU uncertainty. **De-prioritize**; keep the
  extractive fallback excellent instead. This contradicts nothing in the brief but reorders #6's
  priority: extractive → user's Gemini key → (stretch) on-device.

---

## 5. Earlier differentiation hypotheses (superseded by verification update)

1. **Proactive limit meter with confidence levels** — competitors now advertise meters and warnings; test whether an account usage forecast with honest confidence adds value.
2. **Compact project brief instead of transcript paste** — ThreadPort/Context-Sync move *more text*;
   we move *less but better-structured* text (goal/status/decisions/artifacts/open tasks), which
   also preserves the destination provider's free quota — a user benefit competitors can't claim.
3. **Pre-limit nudge** ("this chat is getting expensive — start fresh seeded with the brief") — FreshContext advertises context-window warnings and a fresh start; compare usage-quota forecasting separately.
4. **Intent-based provider routing** — nobody classifies the prompt at all.
5. **Selector health** — fixture tests + remotely refreshable selector config. Every competitor's
   FAQ is "site changed its DOM, open an issue." Ours should be "fixed before you noticed."
6. **Cross-chat project brief** (brief spans multiple chats of one project) — Relay advertises project-scoped memory, so measure provenance and continuity quality instead.

---

## 6. Risks & corrections to the brief

- **§4 correction:** CtxPort now lives at `github.com/nicepkg/ctxport`. "Capsule Hub" repo not
  found under the brief's URL — re-verify or drop. "Claude Counter" unverified — drop or re-find.
- **ChatGPT assumption is stale:** it's no longer a limited text provider (uncapped since
  2026-08-06). Its role flips: it's now the best *destination*, and its metered features
  (images/uploads/deep research) are minor quota targets.
- **Auto-submit vs draft:** ThreadPort, Context-Sync, ContextSwitchAI all auto-submit by default.
  The brief's "never auto-send" is both safer and a positioning asset — say so in the store listing.
- **ToS defensibility:** avoid internal-API/session-cookie approaches (chatgpt-to-claude, GPT2Claude,
  Handoff). DOM reading of the user's own rendered page + user-initiated paste into another
  provider is the pattern every surviving competitor uses; keep it that way.
- **Underestimated effort:** Perplexity + Grok adapters (no public selectors documented anywhere);
  plan Phase 1 fixtures via Playwright captures of the user's own logged-in sessions, and ship
  provider toggles so partial support degrades gracefully.

---

## 7. Recommended Phase-0 → Phase-1 adjustments (beyond the brief's own suggestions)

1. Adopt **CtxPort's Context Bundle** (or a superset of it) as the brief's canonical JSON — free
   interop with an existing OSS ecosystem beats a bespoke format.
2. Add a **`preferences` block** to the brief schema (ContextSwitchAI's "notes injected first"
   idea): style rules the next AI must honor before anything else.
3. Meter design: **budget-burn model** (tokens × conversation-length factor per provider config),
   calibrated by parsed banner reset-times; display "approximate" + confidence always.
4. Evaluation harness: extend the 10-question factual score with a **continuation-quality probe**
   (does the new model's first answer correctly assume prior decisions without re-asking?).
5. Selector bundle: add a **self-test button** in options ("test extraction on current tab") so
   users can diagnose breakage before filing issues — turns selector fragility into a visible,
   owned feature.
6. Ship a **telemetry-free "selector health check"** on popup open (local only: adapter version vs
   bundle version, last successful extraction) — no network call needed.
7. Privacy: publish the privacy policy URL early (reviewers 404-check it) and mirror
   ContextSwitchAI's plain-language permissions table in the listing.

*End of RESEARCH.md — checklist in CODEX_BRIEF.md should mark Phase 0 complete after review.*
