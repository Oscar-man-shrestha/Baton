# Finish Google login for Handoff

Current project: qeoduozlznznptwsfzbt. The Supabase database and public key are configured. Google sign-in, explicit cloud backup, and same-installation restore passed live in Brave on 2026-10-21. The existing local library was retained. Cross-device restore, session expiry/restart, cancellation, and cloud deletion remain untested. No Google client secret belongs in extension source.

## 1. Google Cloud — the screen in your screenshot

- Application type: **Web application**.
- Name: **Handoff**.
- Authorized JavaScript origins: leave empty for this Supabase redirect flow.
- Authorized redirect URIs: add exactly:

  `https://qeoduozlznznptwsfzbt.supabase.co/auth/v1/callback`

- Leave “Use this client for an AI-powered agent” unchecked; this is app sign-in.
- Click Create. Keep the resulting client ID and secret for the next step; do not paste the secret into chat or source code.

## 2. Supabase — Google provider

Open https://supabase.com/dashboard/project/qeoduozlznznptwsfzbt/auth/providers and choose Google.

Enable Google, paste the Google client ID and client secret into the provider settings, and save. Use only the ordinary sign-in scopes (openid, email and profile); no Gmail or Drive access is needed by this implementation.

## 3. Supabase — extension redirect

Reload the current Handoff build, click Local/account → Google sign-in and backup → Google login setup → Copy extension callback.

In Supabase Authentication → URL Configuration → Redirect URLs, add the copied address exactly. It has the form `https://<your-extension-id>.chromiumapp.org/supabase`. Do not put the Supabase callback from step 1 in this field instead. Loading the unpacked extension from a different path/browser may produce a different extension ID and require another exact callback.

## 4. Test

In Handoff choose Check Google setup again, then Sign in with Google. Complete Google's consent screen yourself. If the Google OAuth app is in Testing, add your account under Google Auth Platform → Audience → Test users first.

After returning, reopen Handoff and check the account. Create a small test capsule, choose Back up now, then restore on a separate test browser/profile with the same app account. Local copies are kept during restore. Live sign-in, backup and restore are not verified until this test succeeds.

## Troubleshooting

- Google redirect_uri_mismatch: verify step 1's URI in the Google Web application client.
- Supabase rejects/falls back from the extension redirect: add step 3's exact callback to its redirect allowlist.
- Google provider disabled: enable and save the provider in step 2, then check again.
- Access blocked while Testing: add the signing-in Google account as a test user.
- Cancelled sign-in or failure: local capsules remain on this device; retry without clearing extension storage.

The connected Supabase MCP exposes database/functions tools, not a tool for configuring Google provider credentials. Google client creation and secret entry must be completed in the dashboards.

Official references (checked 2026-10-21):
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/redirect-urls
- https://developer.chrome.com/docs/extensions/reference/api/identity#method-getRedirectURL
