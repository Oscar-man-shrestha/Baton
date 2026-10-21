> Updated 2026-10-21: the user authorized Supabase. The prepared implementation now uses Supabase Google OAuth/PKCE rather than Drive. See `CLOUD_SETUP.md` for the current configuration and pending live tests. The Drive proposal below is historical and inactive.

# Optional Google Drive backup: implementation gate

Status: **not active**. Prepared 2026-10-21 from [Chrome Identity documentation](https://developer.chrome.com/docs/extensions/reference/api/identity) and [Drive appDataFolder documentation](https://developers.google.com/workspace/drive/api/guides/appdata). This is a design for the user-requested save-across-devices feature, separate from switching accounts to bypass service limits.

## Proposed behavior

1. Local recent chats, projects, folders, and the review/copy flow continue without sign-in.
2. A user presses **Back up with Google** in settings. The UI explains that saved chat text will be uploaded to their own Google Drive application-data folder; no automatic connection on installation.
3. The extension requests only Google OAuth identity and `drive.appdata` access, with an OAuth client registered for the final extension ID. It uses Google Drive directly; no Handoff server and no developer account database.
4. A user presses **Back up now** or **Restore**. The app stores a versioned JSON snapshot with a checksum and timestamp. Restore previews counts and conflicts before applying changes to local storage. The UI shows last successful backup and errors. No AI provider credential, cookie, or browser account switch is read or automated.
5. A disconnect control revokes local authorization and stops future backup operations. Local data and the remote backup each have separate explicit delete controls.

## Required before coding or release

- Section 10 of `CODEX_BRIEF_v2.md` requires a stop before using a remote service. Get explicit authorization for sending saved chats to Google Drive and for adding the narrow OAuth/Drive permissions.
- Obtain a Google Cloud OAuth client ID and a stable published extension ID. The planned GitHub repository is still unpublished; Chrome/Brave identity behavior must be tested on the user's own signed-in browser.
- Define conflict, deletion, privacy-policy, and backup-size behavior. No token or OAuth client secret belongs in source control. OAuth access tokens should be held by the browser identity system, not stored with chat records.
- Update `PRIVACY.md`, store listing, permission rationale, tests, and the live-site checklist before enabling the feature.

Until those inputs exist, Handoff saves recent chats and project folders locally. Its JSON project export remains user-initiated and local.
