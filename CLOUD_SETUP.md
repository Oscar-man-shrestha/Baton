# Current cloud setup — 2026-10-21

The extension now contains the public URL and publishable key for your Supabase project `qeoduozlznznptwsfzbt`. The owner-scoped `handoff_backups` table has been applied. SQL role fixtures verified owner isolation, cross-owner write denial and anonymous read denial, then rolled back.

**Remaining setup:** Google is disabled in Supabase Authentication → Providers. Configure your own Google OAuth web client there, using Supabase's callback `https://qeoduozlznznptwsfzbt.supabase.co/auth/v1/callback`. Keep the client secret in Supabase. Add the extension's exact `chrome.identity.getRedirectURL('supabase')` result to Supabase Authentication → URL Configuration. Re-enable/verify sign-in after setup; the app checks public provider availability when opening account controls and before sign-in.

No Google client secret or service-role key belongs in the extension. The public key is intentionally distributable and does not bypass owner-only row policies. Full Google sign-in and cloud backup/restore are not yet live-tested.

## Earlier implementation/setup notes

# Google sign-in and Supabase backup setup

Prepared 2026-10-21. The user authorized Supabase project `qeoduozlznznptwsfzbt`. The MCP server is registered in Codex; OAuth authorization succeeded, but this already-running chat does not expose the newly added server tools. Reload/reconnect Codex before using the database tools. No remote table, provider setting, user account, or backup has been created by this build.

## What Capsule Infinity actually does

Its public source uses Supabase Authentication with Google OAuth and PKCE, then saves app data to its Supabase backend. It also has a local cache. Its backend URL, session, and public key must not be reused for Handoff. Reference: [Capsule Infinity source](https://github.com/ahmadiscoding/capsule-infinity-chrome-extension), inspected commit `8588064`.

## Prepared in Handoff

- Official bundled Supabase client; Google authorization through Chrome's identity window; PKCE code exchange.
- Handoff authentication lives in extension session storage, not the captured chat store. Browser restart requires signing in again. AI provider credentials are never read.
- Explicit Back up now, preview-before-Restore, Disconnect, and Delete cloud backup actions. No automatic upload.
- Full validated backup: conversations, coverage flags, projects, edited drafts, and folders. SHA-256 detects accidental changes, not malicious forgery. This is not end-to-end encryption.
- SQL in `supabase/schema.sql` creates an owner-only backup table with row-level security. Unauthenticated clients have no access. One snapshot per user, maximum 20 MB; backing up replaces the owner's previous snapshot.
- The default config is empty. The local-only build requests neither `identity` nor Supabase host access and shows cloud setup as pending.

## Inputs and steps required

1. Supabase MCP browser authorization is complete. Reload/reconnect Codex to load the new server tools. The server URL is scoped to the project above. A timed-out authorization link must be restarted with `codex mcp login supabase`.
2. Inspect existing tables and authentication configuration before applying `supabase/schema.sql`. If a table with that name already exists, inspect it before changing it. Test two distinct test users and an unauthenticated request against the row policy.
3. Configure Google under Supabase Authentication → Providers. A Google Cloud OAuth web client needs this authorized callback: `https://qeoduozlznznptwsfzbt.supabase.co/auth/v1/callback`. Store the Google client secret in Supabase's provider configuration, never extension source or chat.
4. Provide the project's **publishable key** or legacy **anon key**, and project URL. The extension refuses secret/service-role keys. Put only these public values in `src/config/cloud.json`, then rebuild. The manifest adds `identity` and only this exact Supabase origin when configured.
5. Load the final extension build and obtain `chrome.identity.getRedirectURL('supabase')` for its stable extension ID. Add that exact HTTPS callback URL to Supabase's allowed redirects. Do not use a wildcard. Moving the unpacked folder can change its ID; resolve the production ID before release.
6. Test Google consent/cancellation, PKCE callback, upload, restore on a second browser/device, disconnect, expired session, offline behavior, and remote deletion. Test Chrome and Brave separately.
7. Publish the privacy policy and complete Google branding/audience/verification requirements before public distribution. No paid plan or hosting was provisioned.

## Current status

The integration code and UI are prepared; actual Google authentication, Supabase database access, row isolation, and cross-device restore are **not live-tested or enabled**. MCP registration is not authentication, and MCP authentication is not end-user Google provider setup.

Sources checked 2026-10-21: [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google), [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Chrome Identity](https://developer.chrome.com/docs/extensions/reference/api/identity).
