# Handoff browser extension

Local Chrome MV3 prototype for carrying a compact project brief between distinct AI chat services. The user reviews the text and chooses when to send it. No account switching, credential/cookie access, internal provider APIs, or automatic submission is implemented.

## Try the local build

1. Install dependencies with `npm install`.
2. Run `npm test`, `npm run typecheck`, and `npm run build`.
3. Open `chrome://extensions`, enable Developer mode, and load `.output/chrome-mv3` as an unpacked extension.
4. Open a supported chat, click Handoff, capture visible turns, review the draft and receipt, then choose a destination. If insertion fails, use Copy draft and paste it manually.

Supported site patterns in the manifest: ChatGPT, Claude, Gemini, DeepSeek, Grok, Perplexity. The last three are best-effort only. A local selector check is available in Settings and projects. Provider DOM layouts change; synthetic fixture passing does not prove live compatibility.

## Privacy and limits

- Content scripts read rendered chat text on the six named sites to build local briefs. They do not read cookies or provider account identifiers.
- `storage` saves briefs, projects, preferences, and local diagnostics. `tabs` opens a user-selected destination and `activeTab` supports the current-tab workflow. No broad all-sites access is requested.
- The extension does not run a server or analytics. It does not make provider API requests. Remote selector refresh code exists but is not exposed to users or enabled by default; future use would require a pinned SHA-256 hash and HTTPS.
- The meter labels visible banner evidence or local-history inference. ChatGPT text chat and tool quotas are distinct. No estimate is exact.
- Secret redaction is a regex safety net, not a guarantee. Users must review the draft before transferring it.

## Current verification

Automated tests cover synthetic DOM fixtures for six sites, visible-text sanitization, seeded secret classes, provenance, trimming behavior, meter labeling, prompt classification, and project merge semantics. `npm run eval` reports pending until real target responses are supplied. See [PHASE_STATUS.md](PHASE_STATUS.md) and [LIVE_SITE_CHECKLIST.md](LIVE_SITE_CHECKLIST.md) for the remaining release work.
