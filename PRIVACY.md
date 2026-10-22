# Baton Pass privacy policy draft

Baton Pass (shown as “Baton” in the extension) was previously named Handoff.

**Date:** 2026-10-21. This draft must be published at a stable public URL before a Chrome Web Store submission.

Baton reads rendered conversation text and the unsent prompt in the editor only on the supported AI chat sites named in its manifest. It stores up to 300,000 characters of rendered chat text per chat as a local transcript and uses that text to maintain a local project brief, suggest a destination, show a reviewable handoff draft, and compare current chat size with past chats that showed visible limit notices. The comparison is low confidence and does not know the provider's remaining allowance. The unsent prompt is used for the current suggestion and an approximate token count while typing; it is not saved separately. The prompt status line appears below the composer only when there is room, and can be absent on some layouts. Transcripts, briefs, settings, diagnostics, and limit-event timestamps with approximate token counts are stored in Chrome's local extension storage on the user's device. Users can export projects or a full backup of saved conversation archives, folders, and edited drafts, choose automatic expiry of saved briefs and projects after 7, 30, or 90 days, or delete all Baton data from the options page. Expiry runs when Baton opens.

Baton can open Gemini so the user can select a Google account through Google’s own profile menu. It does not select accounts itself. Baton has no analytics. This configured build supports optional Google app sign-in and user-initiated Supabase backup; local use needs no account. Details follow below. It does not read cookies, passwords, or provider session credentials. It does not submit messages. The user chooses a destination and presses Send there. The extension can optionally open a destination tab and insert text into its editor as a draft.

The local transcript can be incomplete if messages were never rendered, windows do not overlap, or its size cap trims early text. The compact brief can omit details. If the user selects “Try to include older messages” before capture, Baton temporarily scrolls the current chat to read additional rendered messages, then restores the prior scroll position. This is a local, user-initiated action and may still miss some messages on sites that virtualize or load history differently.

Baton may recognize common key and personal-data patterns before rendering a draft, but automated detection can miss sensitive data. Users should inspect and edit the draft. Copying a draft or sending it in a provider's chat is governed by that provider's own policies.

Baton also reads visible usage notices on supported chat pages. It stores the most recent interpreted usage signal per service locally and shows it in a collapsed usage view. Balances older than one hour are shown as unknown. If you turn on desktop usage alerts, Chrome asks for optional notification permission. Baton then notifies you once per observed threshold/window when a service visibly reports 80% or 95% usage, a near-limit notice, or a reached limit. It saves recent notification keys locally to avoid repeats. Baton does not request a service's private usage API, session token, or cookie, and cannot determine an exact free-tier balance when the service does not display one.

When the user opens Baton on a supported chat tab that was already open before installation or update, the extension uses `scripting` and explicit host access limited to the six supported chat sites to start its packaged content script on that active tab. The persistent sidebar can reconnect when the user selects another supported chat tab. This begins local observation without reloading the page. It does not run code on unrelated sites or submit a chat message.

The source includes an opt-in, hash-verified remote selector updater, but the current interface does not enable it. If introduced later, the privacy policy and permission disclosures must be updated with the exact endpoint and data transferred.

## Switching account in the same AI

"Same AI, another account" saves the project on this device and offers it on the next new chat with that AI, for six hours. Pressing Not now forgets the waiting project; the baton itself stays saved. For ChatGPT, Claude and Grok, Baton can open the service's own log-out page, but only after the user presses the button and confirms. For Gemini it opens Google's account chooser. Baton never enters passwords, never reads account details or cookies, and never signs anyone in.

## Feedback

Baton asks for feedback in three places:
- the uninstall page;
- the Feedback page inside Baton;
- a one-time "How's Baton working for you?" card after five passes.

Nothing is sent unless the person presses Send, or taps an answer on the check-in card. What is sent is only what they chose:
- the kind of feedback and an optional reason;
- their message and which AI site it's about;
- Baton's version and the browser's name. On the Feedback page these two can be switched off.

Chats are never sent. Answers go to the project's own Supabase database, where the public key can add answers but not read them. If sending isn't available, the page offers to copy the message or email it to batonforai@gmail.com instead.

## Google Drive backup (optional)

When the person chooses **Back up to Drive**, Baton signs in with Google and saves a file named "Baton backup.json" in their own Google Drive. It uses the `drive.file` permission, so Baton can only see files it created, never anything else in their Drive. The backup holds their saved batons, projects, folders and settings. **Restore from Drive** reads that file back, and newer copies on the device are kept. **Disconnect Google Drive** removes Baton's access on that device; the file stays in their Drive until they delete it.

## Welcome and uninstall pages

After a first install, Baton opens its own welcome page inside the extension. When Baton is removed, the browser opens a feedback page on Baton's site (`oscar-man-shrestha.github.io/handoff/uninstall.html`). Its address carries only Baton's version number. Answering is optional. Only the chosen reason, any text the user types, and the version are sent, to the project's own Google Form, and only when the user presses Send feedback. Until that form is connected, the page only offers to copy the answer or open it in the user's own email app, addressed to batonforai@gmail.com.

## Suggestion rankings

Once a day Baton downloads one public file, `rankings.json`, from its GitHub repository (`raw.githubusercontent.com/Oscar-man-shrestha/handoff/main/rankings.json`). The file holds the order in which Baton suggests AIs for each kind of task. The request carries no cookies and no information about the user, their chats or their prompts. The file is checked before use, and Baton keeps its built-in list if the file is missing, invalid or older. The task type of a prompt is guessed on the device: first from keywords, and when they can't tell, by a small open-source language model (all-MiniLM-L6-v2) that ships inside Baton and runs in a hidden extension page. Prompts are never sent anywhere for this, and the model works offline. The order a user sets in Settings, and the AIs they pick, are stored only in this browser.

## Optional Google sign-in and Supabase backup

The source now includes optional Google OAuth/PKCE and Supabase backup code. When configured and connected, Google and Supabase process app sign-in; Baton stores its own app authentication in extension session storage, cleared when the browser exits. It never reads an AI provider's session credentials. The configured build requests identity access and the exact Supabase project origin, not arbitrary websites.

Only pressing Back up now uploads a snapshot of saved conversations, project summaries, edited drafts, and folders to the configured Supabase project. No automatic background upload is performed. The snapshot may contain sensitive chat content, is not end-to-end encrypted, and is protected by per-user database access rules tested for owner isolation. Restore into an empty separate browser profile passed live; other-computer and full session lifecycle acceptance remain pending. Deleted batons are left out of uploads and backup files; only their chat addresses are kept so a restore does not bring them back. Cloud backup replaces the previous snapshot. Restore previews counts and preserves newer local copies. Disconnect retains local data and the remote backup; Delete cloud backup removes the remote snapshot separately. Local Delete all does not delete a cloud backup.

The configured project is `qeoduozlznznptwsfzbt.supabase.co`. Google sign-in, explicit upload, and same-installation restore passed live in Brave on 2026-10-21. App sign-in is cleared on extension reload or browser exit; the saved local library and cloud backup remain. Cross-device behavior remains pending. Publish this policy with final project/operator contact details before distribution.

## Sidebar and usage display

Usage readings come only from what each service displays on its own pages; Baton calls no private service APIs and reads no session tokens. To keep readings current, Baton can open a service's usage page in a background tab for a few seconds: when the user presses Refresh usage, when Baton is opened (at most every 10 minutes), and about 30 seconds after the user sends a message on Claude, Gemini or ChatGPT (at most every 5 minutes per service). The last two can be switched off in the Usage window. Baton also stores, locally, the times of messages the user sends (not their text) to count messages and estimate usage between readings. The alarms permission is used for that delayed refresh and for reset reminders the user asks for from the limit rescue card: Baton schedules one alarm per service at the reset time the service displayed, then marks its toolbar icon and, if desktop alerts are allowed, shows a notification. When a service shows a limit, the rescue card can open another service with the project as an unsent draft, copy the project to the clipboard, or open Google's own account chooser; it never signs anyone in or out. The sidePanel permission lets the user open Baton in the browser's sidebar. The status strip remains outside the chat editor and can be turned off. Separate observed windows/features are stored locally, with source times; elapsed resets and old readings become unknown. Toolbar badges reflect the last observed service figure, not an independently measured live account balance. Full local backup files contain chat text and should be kept private.


### Usage observation reliability, version 0.2.1

A short equality fingerprint of usage-widget text anchors unchanged relative resets; Baton does not store that surrounding widget text. Per-tab numeric badge readings are held in extension session storage, expire from display, and are cleared on loading a page/closing a tab. Checks run when a supported page updates and when the user returns to a tab; these are observed snapshots rather than continuous authenticated polling. No extra permission or remote provider request is added by this update.

## Contact

Questions about privacy or this policy: **batonforai@gmail.com**.
