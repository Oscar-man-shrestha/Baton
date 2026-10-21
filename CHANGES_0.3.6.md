# Handoff 0.3.6

- Google backup is visible on the dashboard: a card under the library counts shows “Off · saved on this device only” with **Sign in with Google**, or the connected account with its last backup time and **Back up now**.
- The account dialog opens with Google sign-in and backup at the top, no longer inside a collapsed “Google sign-in and backup” section. The developer-only “Google login setup” stays collapsed below it.
- While connected, Sign in with Google is hidden and Back up now, Restore, Disconnect and Delete cloud backup are shown; while signed out, only Sign in is shown. The dialog no longer says “No sign-in is needed” to a connected user.
- One UI regression test.

Verified: 128 tests in 18 files, typecheck, WXT build; build-1 synced. Not checked live: card layout in the 400 px popup and the narrow sidebar, and the card after sign-in (the popup closes during Google sign-in and should show the account when reopened).
