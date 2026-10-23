# Google sign-in and Supabase backup

## Live setup — 2026-10-21

Google sign-in, explicit cloud backup, and same-installation restore passed live in Brave on 2026-10-21. The existing local library was retained. Cross-device restore, session expiry/restart, cancellation, and cloud deletion remain untested.

- Supabase project: `qeoduozlznznptwsfzbt`.
- Google provider enabled; human completed secret entry and Google consent.
- Google callback: `https://qeoduozlznznptwsfzbt.supabase.co/auth/v1/callback`.
- Installed extension: `jpjfbhobndoekfmknlhdpmcndchiilog` from sibling `handoff-extension-build-1`.
- Exact allowlisted extension callback: `https://jpjfbhobndoekfmknlhdpmcndchiilog.chromiumapp.org/supabase`.
- Back up now succeeded; Restore validated one captured conversation and zero named projects, then reported Cloud backup restored. This is a same-installation merge, not evidence of cross-device recovery.
- Database metadata verified one persisted backup, 38,576 bytes, updated at 2026-10-21T17:07:19.399Z. No backup text, tokens, or credentials were retrieved for that check.

No Google client secret or service-role key belongs in the extension. The publishable key is intentionally distributable; owner-only row policies protect stored backups. App authentication uses browser session storage, separate from all AI provider sessions. Upload happens only when Back up now is chosen. Backups are not end-to-end encrypted and contain saved conversation text. One current snapshot is stored per account.

## Capsule Infinity research

Its public source uses Supabase Authentication with Google OAuth and PKCE, app data in Supabase, and a local cache. Handoff uses its own project and client. Reference: [Capsule Infinity source](https://github.com/ahmadiscoding/capsule-infinity-chrome-extension), inspected commit `8588064`.

## Reconfigure or install elsewhere

1. Apply `supabase/schema.sql` in your own project after inspection; owner-only isolation was already applied and tested in the configured project.
2. Configure only the project URL and publishable key in `src/config/cloud.json`; never include privileged keys.
3. Create a Google Web OAuth client and enter its secret directly in Supabase's Google provider form. See [GOOGLE_LOGIN_SETUP.md](GOOGLE_LOGIN_SETUP.md).
4. Add the exact runtime extension callback to Supabase's redirect allowlist. A different unpacked folder can produce a different extension ID.
5. Sign in and explicitly back up; restore previews counts and preserves newer local copies.

## Remaining acceptance

- Second browser/device restore from an empty local library.
- Consent cancellation, expired session, browser restart, disconnect, offline behavior, and separate remote deletion.
- Public Google branding/audience/verification and published privacy policy before distribution.
- No paid plan, hosting deployment, or remote Git push was created.

Sources checked 2026-10-21: [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google), [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Chrome Identity](https://developer.chrome.com/docs/extensions/reference/api/identity).
