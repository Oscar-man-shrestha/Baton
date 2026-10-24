# Baton Pass privacy policy

**Effective:** 24 October 2026 · **Applies to:** Baton Pass 1.1.0 and later (shown as “Baton” in the browser) · **Contact:** batonforai@gmail.com

Baton Pass is an independent browser extension. It is not affiliated with or endorsed by OpenAI, Anthropic, Google, DeepSeek, xAI or Perplexity. ChatGPT, Claude, Gemini, DeepSeek, Grok and Perplexity are trademarks of their owners.

## In short

- Baton works on **six AI chat sites only**: chatgpt.com, claude.ai, gemini.google.com, chat.deepseek.com, grok.com and www.perplexity.ai.
- Your chats, batons, drafts and settings are kept **in your browser**. Baton has **no analytics and no tracking**.
- Baton **never sends a message** for you. It types a draft (and may attach files) in the chat box of the AI *you* choose; you read it and press Send.
- Baton **never reads cookies or passwords** and never signs you in or out of an AI service.
- Data leaves your browser only when **you** do something that needs it: send a draft, back up, or send feedback. The one automatic request is a daily download of a public file of AI rankings, which carries nothing about you.

## What Baton reads, and where

| Where | What | Why |
|---|---|---|
| The six AI chat pages | The conversation shown on the page and the text you are typing (not sent anywhere) | To build a baton (a saved copy and a summary), count tokens, and suggest which AI fits your task |
| The same sites' own chat data | The chat you are on, as that service stores it, fetched from that service's own site with the session the page already has | So a saved or passed chat is complete: the page often shows only the messages near the screen |
| The same sites' own files | Files you uploaded to that chat, fetched from that service's site | Only when you pass a chat, to attach them to the next AI's chat box |
| The same sites' own usage figures | Usage responses (for example “72% of session left, resets 14:40”) that the page fetches for itself or that Baton requests from the same address | To show how much each AI has left |

On ChatGPT and DeepSeek, fetching the chat or usage uses the short-lived session token that site's own page uses; on Gemini, the page's own request token. Baton uses it only for that one request to that same site, and **never stores it or sends it anywhere else**. On ChatGPT, Claude and Gemini a small script copies only the usage responses those pages fetch (by address); from a reply stream it keeps only the usage report, never the reply. The page receives the original unchanged.

Baton does not read any other website. It cannot see your other tabs' addresses.

## What Baton keeps on your device

Stored in the browser's own extension storage, on your device:

- **Batons:** saved chats (up to 300,000 characters of chat text per chat), summaries, edited drafts, folders and projects.
- **Usage readings:** the latest figures each service reported, with when they were read; the times (not the text) of messages you send, to count messages between readings.
- **Settings and small diagnostics:** your choices, the last check results, which tips you dismissed.

You can export everything to a backup file, set saved batons to expire after 7, 30 or 90 days, delete single batons, or delete all Baton data in Settings. Removing the extension removes this storage. A backup file contains your chat text: keep it private.

## What leaves your device, and only when

| When | What is sent | To whom |
|---|---|---|
| You pass a chat to another AI and press Send there | The draft you reviewed, plus any files Baton attached (your uploads, and for long chats a Markdown copy of the chat) | The AI service you chose. Attaching a file may upload it to that service as soon as it is attached, as when you add a file yourself |
| You choose “Have this AI write the handoff” and press Send | Baton's request, typed into that chat's box | The service you are on |
| You sign in with Google and press **Back up now** (optional) | A snapshot of your batons, summaries, drafts and folders | Baton's Supabase project (`qeoduozlznznptwsfzbt.supabase.co`), protected by per-user access rules; **not end-to-end encrypted** |
| You press **Send** on a feedback screen, or tap an answer on the one-time check-in card | The kind of feedback, an optional reason and message, which AI site it concerns, and (if left on) Baton's version and your browser's name. Never chats | Baton's feedback table (insert-only: the public key can add answers, not read them) |
| Once a day, automatically | A plain download request for `rankings.json` from Baton's GitHub repository; no cookies, nothing about you, your chats or prompts | GitHub (raw.githubusercontent.com) |
| You remove Baton | The browser opens Baton's uninstall feedback page; its address carries only Baton's version. Answering is optional | GitHub Pages; answers, if sent, go to the feedback table |

Copying a draft puts it on your clipboard. Text you send to an AI service is governed by that service's privacy policy.

**Google Drive backup** exists in the code but is switched off in this release. If it is turned on in a future release, it will save one file, “Baton backup.json”, in your own Drive with the `drive.file` scope (Baton could see only the files it created), and this policy will be updated first.

## Things Baton does on your device only

- **Suggesting an AI for your task:** the topic of your prompt is guessed from keywords and, when they can't tell, by a small open-source language model (all-MiniLM-L6-v2) that ships inside Baton and runs offline in a hidden extension page. Prompts are never sent anywhere for this.
- **Checking a handoff:** after the next AI's first reply, Baton compares it with the handoff (your rules, what you turned down, your latest request) and may offer a correction for the chat box.
- **Long-chat tip:** Baton measures the chat's length (at most once a minute while the chat changes) and may suggest a fresh chat with a handoff.
- **Redaction:** before a draft is shown, common key, token and personal-data patterns are masked. This is a safety net, not a guarantee: always read the draft.

## Accounts and sign-in

Local use needs no account. Optional Google sign-in is used only for Baton's own backup; Baton keeps its sign-in in session storage, cleared when the browser closes. “Same AI, another account” only opens that service's own log-out page (after you confirm) or Google's account chooser. Baton never enters passwords and never reads account details.

## Permissions

| Permission | Used for |
|---|---|
| Access to the six AI chat sites | Reading chats and usage, typing drafts and attaching files there. No other site |
| `storage` | Keeping your batons, settings and usage readings on your device |
| `activeTab`, `scripting` | Connecting Baton to an AI tab that was already open when Baton was installed or updated |
| `sidePanel` | Opening Baton in the browser's side panel |
| `alarms` | Delayed usage refresh and the reset reminders you ask for |
| `offscreen` | Running the on-device task model in a hidden extension page |
| `contextMenus` | One right-click item, “Save selection as a baton”, on the six AI sites |
| `identity` and access to Baton's Supabase address | Optional Google sign-in and backup |
| `notifications` (optional, asked when you turn on alerts) | Desktop alerts for usage limits and resets |

## Children

Baton is not directed at children under 13 and does not knowingly collect their data.

## Changes to this policy

Changes are published in this file (with a new effective date) and noted in the [changelog](CHANGELOG.md). A change that sends new data anywhere will be described before it ships.

## Contact

Questions or requests about privacy: **batonforai@gmail.com**. To delete a cloud backup, use **Delete cloud backup** in Baton's Backups and data, or write to this address.
