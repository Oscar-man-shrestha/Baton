# Handoff privacy policy draft

**Date:** 2026-10-21. This draft must be published at a stable public URL before a Chrome Web Store submission.

Handoff reads rendered conversation text and the unsent prompt in the editor only on the supported AI chat sites named in its manifest. It stores up to 300,000 characters of rendered chat text per chat as a local transcript and uses that text to maintain a local project brief, suggest a destination, show a reviewable handoff draft, and compare current chat size with past chats that showed visible limit notices. The comparison is low confidence and does not know the provider's remaining allowance. The unsent prompt is used for the current suggestion and an approximate token count while typing; it is not saved separately. The prompt status line appears below the composer only when there is room, and can be absent on some layouts. Transcripts, briefs, settings, diagnostics, and limit-event timestamps with approximate token counts are stored in Chrome's local extension storage on the user's device. Users can export projects or a full backup of saved conversation archives, folders, and edited drafts, choose automatic expiry of saved briefs and projects after 7, 30, or 90 days, or delete all Handoff data from the options page. Expiry runs when Handoff opens.

Handoff can open Gemini so the user can select a Google account through Google’s own profile menu. It does not select accounts itself. Handoff has no analytics. This configured build supports optional Google app sign-in and user-initiated Supabase backup; local use needs no account. Details follow below. It does not read cookies, passwords, or provider session credentials. It does not submit messages. The user chooses a destination and presses Send there. The extension can optionally open a destination tab and insert text into its editor as a draft.

The local transcript can be incomplete if messages were never rendered, windows do not overlap, or its size cap trims early text. The compact brief can omit details. If the user selects “Try to include older messages” before capture, Handoff temporarily scrolls the current chat to read additional rendered messages, then restores the prior scroll position. This is a local, user-initiated action and may still miss some messages on sites that virtualize or load history differently.

Handoff may recognize common key and personal-data patterns before rendering a draft, but automated detection can miss sensitive data. Users should inspect and edit the draft. Copying a draft or sending it in a provider's chat is governed by that provider's own policies.

Handoff also reads visible usage notices on supported chat pages. It stores the most recent interpreted usage signal per service locally and shows it in a collapsed usage view. Balances older than one hour are shown as unknown. If you turn on desktop usage alerts, Chrome asks for optional notification permission. Handoff then notifies you once per observed threshold/window when a service visibly reports 80% or 95% usage, a near-limit notice, or a reached limit. It saves recent notification keys locally to avoid repeats. Handoff does not request a service's private usage API, session token, or cookie, and cannot determine an exact free-tier balance when the service does not display one.

When the user opens Handoff on a supported chat tab that was already open before installation or update, the extension uses `scripting` and explicit host access limited to the six supported chat sites to start its packaged content script on that active tab. The persistent sidebar can reconnect when the user selects another supported chat tab. This begins local observation without reloading the page. It does not run code on unrelated sites or submit a chat message.

The source includes an opt-in, hash-verified remote selector updater, but the current interface does not enable it. If introduced later, the privacy policy and permission disclosures must be updated with the exact endpoint and data transferred.

## Optional Google sign-in and Supabase backup

The source now includes optional Google OAuth/PKCE and Supabase backup code. When configured and connected, Google and Supabase process app sign-in; Handoff stores its own app authentication in extension session storage, cleared when the browser exits. It never reads an AI provider's session credentials. The configured build requests identity access and the exact Supabase project origin, not arbitrary websites.

Only pressing Back up now uploads a snapshot of saved conversations, project summaries, edited drafts, and folders to the configured Supabase project. No automatic background upload is performed. The snapshot may contain sensitive chat content, is not end-to-end encrypted, and is protected by per-user database access rules tested for owner isolation. Cross-device and full session lifecycle acceptance remain pending. Cloud backup replaces the previous snapshot. Restore previews counts and preserves newer local copies. Disconnect retains local data and the remote backup; Delete cloud backup removes the remote snapshot separately. Local Delete all does not delete a cloud backup.

The configured project is `qeoduozlznznptwsfzbt.supabase.co`. Google sign-in, explicit upload, and same-installation restore passed live in Brave on 2026-10-21. App sign-in is cleared on extension reload or browser exit; the saved local library and cloud backup remain. Cross-device behavior remains pending. Publish this policy with final project/operator contact details before distribution.

## Sidebar and usage display

The sidePanel permission lets the user open Handoff in the browser's sidebar. The status strip remains outside the chat editor and can be turned off. Separate observed windows/features are stored locally, with source times; elapsed resets and old readings become unknown. Toolbar badges reflect the last observed service figure, not an independently measured live account balance. Full local backup files contain chat text and should be kept private.


### Usage observation reliability, version 0.2.1

A short equality fingerprint of usage-widget text anchors unchanged relative resets; Handoff does not store that surrounding widget text. Per-tab numeric badge readings are held in extension session storage, expire from display, and are cleared on loading a page/closing a tab. Checks run when a supported page updates and when the user returns to a tab; these are observed snapshots rather than continuous authenticated polling. No extra permission or remote provider request is added by this update.
