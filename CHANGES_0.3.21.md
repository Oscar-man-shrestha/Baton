# Handoff 0.3.21 — stated limits and "N left" notices (safe methods only)

The opt-in unofficial Grok reading was started, then dropped at the user's request: the Claude Code safety check blocked it, and the user chose the safe way. Its two files were deleted unused. Handoff reads only what services show on their own pages.

- **Limits the service states.** When a limit message states the allowance (“You’ve reached your limit of 20 messages per 2 hours”, “limit of 5 Pro searches per day”, “every 90 minutes”), Handoff keeps it and counts against it: “4 of 20 msgs in last 2 h · ≈16 left (limit stated by Grok)”, using the stated window. This wins over a learned limit and works on any service.
- **“N left” notices.** Plain-text notices such as “3 Pro searches left”, “You have 2 responses left” or “1 message remaining” become exact readings, shown under the composer, in the sidebar card and in the Usage window. “0 … left” counts as a reached limit. They are ignored inside chat messages, as before.
- **Rescue card ranking.** A service with no official balance but a counted one (stated or learned) is ranked by it: “≈16 of 20 left (counted)” counts as room. “≈0 left” stays unknown rather than being called limited, because it is a count, not the service's word.
- 13 tests in `tests/stated-limits.test.ts`.

**Incident during this release:** the first 0.3.21 build was cut off and produced only `background.js`. The build-1 sync uses `rsync --delete`, so it removed every other file from the installed folder, including `manifest.json`, leaving the loaded extension broken. The extension's stored data, kept by the browser, was not affected. A complete rebuild was synced within minutes. Syncing now requires `manifest.json`, the content script and the expected version to be present in the build first.

Verified: 205 tests in 28 files, typecheck, complete WXT build (manifest, pages, content script, chunks); build-1 restored and identical to the build. Wordings are representative, because no real Grok, DeepSeek or Perplexity limit message has been captured yet.
