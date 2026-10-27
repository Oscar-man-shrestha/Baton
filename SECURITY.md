# Security policy

Baton reads AI conversations on six sites and can hold the user's chats, so security and privacy problems matter more than any other bug.

## Reporting a problem

Please **don't open a public issue**. Email **batonforai@gmail.com** with “Security” in the subject, or use GitHub's private vulnerability reporting (Security tab → Report a vulnerability). Include what you found, how to reproduce it, and the Baton version. You'll get a reply within a few days.

Examples worth reporting: a page that can read Baton's stored chats or make Baton act on it; chat text or tokens leaving the browser in a way [PRIVACY.md](PRIVACY.md) doesn't describe; a draft or file sent somewhere the user didn't choose; prompt injection in a captured chat that makes Baton itself do something.

## Supported versions

Only the latest version in the Chrome Web Store gets fixes.

## Design rules the code follows

- Access to the six AI chat sites only; no `tabs` permission, no `<all_urls>`.
- No remote code: the model, its WebAssembly engine and fonts ship in the package.
- Never sends a chat message, never reads cookies or passwords, never signs in or out of an AI service.
- Session tokens a site's own page uses are used only for one request to that same site and never stored.
- Captured chats are treated as quoted data in handoffs, inside a random boundary, with an instruction not to follow commands in them; hidden instruction-like text is removed and flagged.
- The public Supabase key can insert feedback but not read it; backups are protected by per-user row rules, and signed-in users hold only select, insert, update and delete on their own row.
- Baton's buttons and cards on AI pages live in closed shadow roots, so page scripts can't read or click them. The only message a page can send Baton is a usage reading for its own site, checked for origin and size.
- Drafts open only on https pages of the six sites, with limits on file count and size; chat files download only from the site's own paths or https links.
- The one file fetched at runtime, `rankings.json`, is data only: fetched without cookies, size-capped, schema-checked, limited to known AIs, never older than the bundled copy, and its short reasons are shown as plain text and may not contain links.
- Builds use the lockfile (`npm ci`), CI actions are pinned to exact commits with read-only permissions, and Dependabot checks dependencies weekly.
