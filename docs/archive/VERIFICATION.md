# Verification — Handoff 0.3.2

Date: 2026-10-21. Local checks and remote database checks are distinct from signed-in provider acceptance.

See [LIVE_VALIDATION_2026-10-21.md](LIVE_VALIDATION_2026-10-21.md) for narrowly scoped installed-browser results.

## Passed

- 0.3.2 adds active-tab/sidebar switching, unsupported-page clearing, failed connection recovery and stale-response race regression tests.
- Google OAuth, explicit cloud upload and same-installation restore passed live in the installed Brave extension; the user completed Google consent. Remote metadata confirmed one 38,576-byte backup. The existing library remained present.
- 0.3.1 adds callback separation/validation tests and direct access to the all-provider Usage dialog. Isolated UI checks cover refresh of open tabs and exact extension callback copying.

- 115 tests in 17 files: adapters, Markdown/code preservation, capture merging, briefs, redaction, budgets, routing, usage parsing/expiry/delivery, backups, durable full-capsule snapshots and mocked Google PKCE behavior.
- TypeScript check and WXT production build, including popup, sidebar, options, content script and worker. Build warns about tokenizer chunk size; it compiles successfully.
- Isolated Brave UI fixtures: real dashboard counts and three quick actions, folder creation, manual capsule saving, quick copy/redaction, full snapshot capture, unchanged-capture deduplication, snapshot restoration after the live archive changes, full-tail copy, compact transfer review gate, search/delete, 400×600 dark/light popup, 320-pixel sidebar, separate 31%/5% Claude fixture readings and Read usage navigation. Cloud settings are mocked to verify the disabled-Google message. See sibling ui-previews/browser-checks.json.
- Packaged content fixtures: 12 virtualized turns in order, restored scroll position, streaming update, cross-tab quota update, non-interactive below-composer usage strip and draft insertion without submit. See sibling ui-previews/content-checks.json.
- Supabase project qeoduozlznznptwsfzbt: inspected empty public schema, applied owner-scoped handoff_backups migration, verified RLS enabled and anon read privileges denied. Transactional fixtures tested owner-only visibility, cross-owner update denial and cross-owner insert rejection; rolled back all fixtures.
- Retrieved the project's publishable key and configured it in the extension. No service-role or Google client secret is present. Google provider is now enabled and live Google sign-in passed. Earlier isolated fixtures still test the disabled-provider recovery path.
- Capsule Infinity's MIT notice is included in source and the loadable build for the adapted dashboard/component styling.

## Not passed or not run

- Signed-in capture/insertion on live ChatGPT, Claude, Gemini, DeepSeek, Grok and Perplexity. Fixtures cannot prove compatibility with every current layout or recover never-rendered history/media.
- Continuous live quota accuracy across all providers, actual threshold notifications and badges in real provider sessions. Claude visible settings readings matched in one live account; other provider balances remain unverified. Private provider APIs/response interception remain disabled. Claude metadata parsers are not equivalent to a live Claude Monitor connection.
- Restore on a different computer, session refresh/expiry, browser restart, cancellation, offline restore, disconnect and authenticated remote deletion. Same-installation restore passed, and on 2026-10-21 a restore into an empty, newly created Brave profile on the same Mac passed (see `LIVE_RESTORE_TEST_2026-10-21.md`).
- Hosted AI compression, teams and collaboration are not implemented. Local compact selection and full snapshot saving work without a paid AI backend.
- Real two-target, three-generation handoff evaluation still lacks target responses. No superiority score is claimed.
- Chrome Web Store approval, Google app verification, privacy-policy publication and assistive-technology audit.

## Release checklist

- [x] Local tests, typecheck, build and isolated UI/content checks.
- [x] Full snapshots persist without rewriting existing saved data; local backup remains available.
- [x] Supabase owner-scoped table applied and transactional RLS checks passed.
- [x] Public cloud configuration installed; Google enabled and exact callback allowlisted.
- [x] No auto-submit, credential/cookie manipulation, AI account switching or quota evasion.
- [x] Enable Google under Supabase Authentication → Providers and allowlist the exact extension callback.
- [x] Complete live installed Google sign-in, explicit upload and same-installation restore.
- [ ] Complete signed-in Google/cloud and provider acceptance checks.
- [ ] Complete real handoff quality evaluation.
- [ ] Privacy-policy URL: **pending: repo not yet published**. User publishes later; no remote push or hosting was created.
