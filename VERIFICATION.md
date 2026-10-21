# Verification — Handoff 0.2.1

Date: 2026-10-21. These are observed results, not a claim of public release readiness.

## Passed locally

- Version 0.2.1 regression coverage includes decimal/invalid percentages, reset drift and expiry, unchanged expired labels, isolated feature resets, simultaneous alerts through the actual background handler, most-constrained badge selection, and expired badge clearing.

- 101 unit/fixture tests in 15 test files passed on the updated Vitest 5.0.5 toolchain. Includes all six provider adapters, reported Gemini/DeepSeek regressions, rich Markdown, legitimate repeats, streaming/history merge, source-code preservation, redaction, budget gate, router basics, usage parsing/expiry, recent captures, backups, and mocked Supabase sign-in/backup boundaries.
- Final TypeScript check passed.
- Final WXT 0.21.4 production build passed with popup, settings, sidebar, background worker, and content script. Build warnings concern tokenizer chunk size and third-party pure-comment annotations, not compilation errors. Total unpacked build is approximately 9 MB.
- Clean installation audit: 199 packages, zero known vulnerabilities reported at installation time. This is a dependency advisory result, not a full security audit.
- Isolated Brave 149.0.7827.155 browser checks: real saved-item counts; empty folder creation; honest unconfigured cloud state; capture/review/destination progression; no automatic send; oversize full context preserves its tail and can be copied; folder search; exact saved manual edits; 400×600 popup; 320-pixel sidebar; settings folder change; no page errors or external frontend requests. Final reports are in sibling `ui-previews/browser-checks.json` and `content-checks.json`.
- Packaged content-script checks use an intercepted synthetic provider page: collect all 12 virtualized turns in order, restore the middle scroll position, update a streaming reply without duplication, fill a draft without a submit event, receive a quota-window update from another tab immediately, and keep the usage strip below the fixture composer with no click interception.
- Supabase MCP registration and OAuth login succeeded for the user-selected project. The current chat reports the server as unavailable in its running tool catalog, so no remote database operation has been performed.

Checks were run from a clean temporary source/dependency copy after workspace dependency file reads stalled. The delivered source uses the same lockfile; the packaged build comes from that clean build. Browser tests used an isolated profile and synthetic Chrome APIs/provider DOM; they did not read the user's browser profile, cookies, or signed-in conversations.

## Not passed or not run

- Signed-in capture/insertion on current ChatGPT, Claude, Gemini, DeepSeek, Grok, and Perplexity layouts. Fixtures cannot prove live compatibility or complete capture of hidden/unloaded history/media.
- Actual provider quota accuracy, account identity changes, notifications, and toolbar badges across real service sessions. DOM observations are snapshots; continuous exact balances remain unavailable where the service exposes no usable value.
- Private provider APIs and stream interception: not enabled. Claude numeric-shape parsing is tested, but it is not a live Claude Monitor replacement.
- Supabase schema application, live row-level-security isolation, Google provider settings, actual OAuth callback, cloud upload/delete, and restore on another device. Code and SQL are prepared; public project key and provider/redirect setup remain pending.
- The five-case, two-target, three-generation evaluation harness was run and exited with status 2 because real target responses are absent. No 8/10 score, cross-model quality, or superiority claim is made. Its latest pending status is saved in `evaluation/latest-status.json`.
- Chrome Web Store approval, Google app verification, production privacy-policy publication, assistive-technology audit, and Chrome-specific live side-panel behavior.

## Release gates

- [x] Local tests, type check, production build, isolated UI/content checks.
- [x] Documentation distinguishes local checks from live acceptance.
- [x] No auto-submit, AI account switching, cookie access, or limit evasion.
- [x] Complete local backup and restore exist without sign-in.
- [x] Supabase MCP login completed; integration prepared behind configuration.
- [ ] Reconnect Codex to load Supabase tools; inspect the existing project before schema changes.
- [ ] Configure and live-test Google/Supabase sign-in, owner isolation, and cloud restore.
- [ ] Test current signed-in provider pages and feature quota notices.
- [ ] Complete real two-target handoff evaluation.
- [ ] Privacy-policy URL: **pending: repo not yet published**. User will publish the repository themselves. No remote git push or server hosting was created.
