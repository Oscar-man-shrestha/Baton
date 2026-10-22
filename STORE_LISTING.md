# Chrome Web Store listing draft

**Name:** Baton Pass — continue any AI chat where you left off

**Short description:** Save your AI project, see real usage limits, and pass it to another AI as a draft you send yourself.

**Description:** Baton helps you carry a project's goal, decisions, latest artifact, and next step into another AI chat. Open a supported chat, capture the visible conversation, inspect the local brief and redaction receipt, choose a destination, and decide when to send. The extension does not submit messages automatically. It shows an approximate prompt token count without covering the editor when there is room, and only shows a remaining balance when the service visibly reports one. A collapsed usage view covers six supported chats and offers optional desktop alerts at visible thresholds. Unknown or stale balances are labeled accordingly. Baton keeps a bounded local transcript that the user can copy, with warnings when capture may be incomplete. The current build has synthetic fixtures for all six services; live-site compatibility must be confirmed before publication.

**Permissions justification:**

- `storage`: keeps bounded local transcripts, briefs, settings, project records, and diagnostics.
- Tabs: Baton opens the AI you choose in a new tab and sends its draft there. It needs no `tabs` permission for this; it can only see tabs on the six AI sites listed below.
- `activeTab`: checks the chat tab the user is working in.
- `scripting`: connects the packaged Baton content script to the active supported chat after the user opens Baton, if that tab predates installation or update. Explicit host access to the same six supported chat sites allows the persistent sidebar to reconnect on tab changes. No page reload is required.
- `sidePanel`: opens the library/capture interface in the browser sidebar at the user’s request.
- `offscreen`: runs Baton's on-device task model (a small open-source language model, bundled in the extension) in a hidden extension page, to suggest which AI fits a prompt. The text is processed on the device and never sent anywhere. The extension's content security policy allows WebAssembly (`wasm-unsafe-eval`) only for this model engine; no remote code is loaded.
- Optional `notifications`: requested only when the user enables desktop usage alerts; shows alerts for service-reported usage thresholds and limit notices.
- Access to the six named AI chat hosts: reads rendered conversation text, observes visible limit notices, and inserts a reviewed draft in the destination editor. No access to unrelated websites is requested.

**Privacy policy URL:** https://github.com/Oscar-man-shrestha/handoff/blob/main/PRIVACY.md

**Publication status:** pending: repo not yet published. The file is in this repository root; the URL is the planned location supplied by the user. Do not submit this listing until the user publishes the repository and the URL resolves publicly to the final policy.

## 0.2.0 additions and release boundary

The local build adds recent contexts, folders, exact edited draft saving, full local backup/restore, rich Markdown/full-conversation export, and a responsive sidebar. It retains only rendered text and explicitly warns about missing history/media and the archive cap. The configured build includes optional Google sign-in, identity permission and the exact Supabase project origin; local use remains available without an account.

When configured, Google/Supabase sign-in adds `identity` and the exact configured Supabase project origin. Installed Google sign-in, manual upload and same-installation restore passed live in Brave. Cross-device restore, disconnect, session lifecycle and cloud deletion still need acceptance before publication. Do not advertise live cloud sync or continuous exact quota tracking in the current listing. The planned privacy-policy URL above remains pending: repo not yet published.

## Store images (0.3.41)

Rendered with `npm run render:store` from `store/src/*.html` (local Brave or Chrome, throwaway profile). Upload these files from `store/`:

| Store field | File | Size |
|---|---|---|
| Screenshot 1 | `screenshot-01-continue.png`: hit the limit, pass the baton | 1280×800 |
| Screenshot 2 | `screenshot-02-usage.png`: usage bar and all six lanes | 1280×800 |
| Screenshot 3 | `screenshot-03-suggest.png`: suggestions by task | 1280×800 |
| Screenshot 4 | `screenshot-04-draft.png`: arrives as a draft, you press Send | 1280×800 |
| Screenshot 5 | `screenshot-05-private.png`: privacy rules | 1280×800 |
| Small promo tile | `promo-small-440x280.png` | 440×280 |
| Marquee promo tile | `promo-marquee-1400x560.png` | 1400×560 |

The screenshots show Baton's real interface with example chats and figures.

**Suggested name and summary.** The name carries the use case, because people search for the problem:
- Name: `Baton Pass: Continue AI chats when you hit the limit`
- Summary (132 characters max): `Hit your ChatGPT, Claude or Gemini limit? Continue the same chat in another AI in one click, with your context. Free and private.`

## Contact

- Developer and support email (Chrome Web Store contact field, privacy policy, site footer): **batonforai@gmail.com**
- Google account display name: **Baton**
- Use this account for the developer registration (one-time $5 fee), the uninstall Google Form, and support mail. Turn on 2-Step Verification.

## Optional sign-in permission

`identity`: used only when the person chooses Google sign-in, for Baton backup or Google Drive backup. It opens Google's own sign-in window. Drive access uses the `drive.file` scope, so Baton sees only the files it creates.
