# Handoff 0.3.1 — visible usage limits and guided Google login

2026-10-21

- Header Usage button opens one view for all six supported services, reset information, provider-reading timestamps, optional desktop alerts and the prompt-strip toggle. Refresh open AI tabs bootstraps existing supported tabs and reads displayed usage without reloading them.
- Active-service usage moved above recent capsules. Percentage remaining is shown alongside the original used percentage/reset detail; message/feature counts and token balances retain their own units. Unknown stays unknown.
- Usage snapshots refresh once per minute while the UI is open. Provider DOM monitoring and 80%/95%/reached alert behavior remain in the content/background code.
- Google login setup now shows the Google-to-Supabase callback and the exact Supabase-to-extension callback, plus Copy extension callback, Open Supabase Google settings and Check Google setup again.
- Callback helper validates the extension redirect and never contains a Google client secret. OAuth stays PKCE and uses the background worker so closing a toolbar popup does not stop login.

107 automated tests, TypeScript checks and production build passed. Isolated Brave UI/content results are in sibling ui-previews reports. Google provider configuration and real Google/cloud acceptance remain pending unless separately confirmed. No private provider quota APIs, auto-submit or AI account switching are enabled.

See GOOGLE_LOGIN_SETUP.md for the exact fields from the user's screenshot. See VERIFICATION.md for acceptance boundaries.
