# Verification — Handoff 0.3.1

Date: 2026-10-21. Local checks and remote database checks are distinct from signed-in provider acceptance.

## Passed

- 0.3.1 adds callback separation/validation tests and direct access to the all-provider Usage dialog. Isolated UI checks cover refresh of open tabs and exact extension callback copying.

- 107 tests in 16 files: adapters, Markdown/code preservation, capture merging, briefs, redaction, budgets, routing, usage parsing/expiry/delivery, backups, durable full-capsule snapshots and mocked Google PKCE behavior.
- TypeScript check and WXT production build, including popup, sidebar, options, content script and worker. Build warns about tokenizer chunk size; it compiles successfully.
- Isolated Brave UI fixtures: real dashboard counts and three quick actions, folder creation, manual capsule saving, quick copy/redaction, full snapshot capture, unchanged-capture deduplication, snapshot restoration after the live archive changes, full-tail copy, compact transfer review gate, search/delete, 400×600 dark/light popup, 320-pixel sidebar, separate 31%/5% Claude fixture readings and Read usage navigation. Cloud settings are mocked to verify the disabled-Google message. See sibling ui-previews/browser-checks.json.
- Packaged content fixtures: 12 virtualized turns in order, restored scroll position, streaming update, cross-tab quota update, non-interactive below-composer usage strip and draft insertion without submit. See sibling ui-previews/content-checks.json.
- Supabase project qeoduozlznznptwsfzbt: inspected empty public schema, applied owner-scoped handoff_backups migration, verified RLS enabled and anon read privileges denied. Transactional fixtures tested owner-only visibility, cross-owner update denial and cross-owner insert rejection; rolled back all fixtures.
- Retrieved the project's publishable key and configured it in the extension. No service-role or Google client secret is present. Anonymous public auth settings report Google disabled; sign-in is blocked with a setup explanation until enabled.
- Capsule Infinity's MIT notice is included in source and the loadable build for the adapted dashboard/component styling.

## Not passed or not run

- Signed-in capture/insertion on live ChatGPT, Claude, Gemini, DeepSeek, Grok and Perplexity. Fixtures cannot prove compatibility with every current layout or recover never-rendered history/media.
- Exact live account quota accuracy, actual threshold notifications and badges in real provider sessions. Private provider APIs/response interception remain disabled. Claude metadata parsers are not equivalent to a live Claude Monitor connection.
- Real Google OAuth, extension redirect allowlisting, authenticated API backup/delete, cross-device restore and session refresh. Google provider is disabled in the user's project; configure it before these checks.
- Hosted AI compression, teams and collaboration are not implemented. Local compact selection and full snapshot saving work without a paid AI backend.
- Real two-target, three-generation handoff evaluation still lacks target responses. No superiority score is claimed.
- Chrome Web Store approval, Google app verification, privacy-policy publication and assistive-technology audit.

## Release checklist

- [x] Local tests, typecheck, build and isolated UI/content checks.
- [x] Full snapshots persist without rewriting existing saved data; local backup remains available.
- [x] Supabase owner-scoped table applied and transactional RLS checks passed.
- [x] Public cloud configuration installed; disabled Google provider reported accurately.
- [x] No auto-submit, credential/cookie manipulation, AI account switching or quota evasion.
- [ ] Enable Google under Supabase Authentication → Providers and allowlist the exact extension callback.
- [ ] Complete signed-in Google/cloud and provider acceptance checks.
- [ ] Complete real handoff quality evaluation.
- [ ] Privacy-policy URL: **pending: repo not yet published**. User publishes later; no remote push or hosting was created.
