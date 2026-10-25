# Chrome Web Store listing — Baton Pass 1.1.0

Everything to paste into the Chrome Web Store developer dashboard (and Microsoft Edge Add-ons, which uses the same fields). The step-by-step submission guide is [PUBLISHING.md](PUBLISHING.md).

## Store listing tab

**Name** (in the manifest: `Baton Pass`; the store shows the manifest name)

```
Baton Pass
```

**Summary** (manifest `description`, 132 characters max; this is what the manifest ships)

```
Continue any AI chat where you left off: save your project, see usage limits, and pass it to another AI as a draft.
```

**Category:** Productivity → Tools (or Workflow & Planning) · **Language:** English

**Description**

```
Hit your ChatGPT, Claude or Gemini limit in the middle of a project? Baton carries the whole conversation to another AI so you can keep going, without re-explaining anything.

HOW IT WORKS
• A glowing Baton button sits by the chat box on ChatGPT, Claude, Gemini, DeepSeek, Grok and Perplexity.
• Pick another AI. It opens with your project typed in as a draft. You read it and press Send. Baton never sends anything for you.

WHAT MAKES THE HANDOFF GOOD
• The whole chat, not just what's on screen: Baton reads the chat as the service stores it, so long chats keep their first messages.
• Exact names and figures (file names, functions, paths, amounts) are kept word for word.
• Long chats go as a summary plus the complete chat attached as a file. Your uploaded files are re-attached where the site allows.
• After the next AI's first reply, Baton checks it took in your rules, what you turned down and your latest request, and offers a one-click correction.
• "Messages: 64 (32 yours, 32 replies), in order": you see what was captured.

USAGE LIMITS IN ONE PLACE
• A small bar under the chat box shows what each AI has left and when it resets, from the figures the service itself reports.
• When you hit a limit, Baton suggests where to continue, ranked for your task.
• A tip suggests a fresh chat when a conversation gets long enough that answers start to slip.

BATONS
• Save a chat (or just the part you select) as a baton, file it in folders, and pass it on later. Keyboard shortcuts and a side panel included.

PRIVATE BY DESIGN
• Your chats stay in your browser. No account needed, no analytics.
• Baton never reads cookies or passwords and never signs you in or out.
• Optional Google sign-in only for your own backup.

Baton Pass is independent and not affiliated with OpenAI, Anthropic, Google, DeepSeek, xAI or Perplexity. ChatGPT, Claude, Gemini, DeepSeek, Grok and Perplexity are trademarks of their owners.
```

**Images** (all in `store/`, rendered by `npm run render:store` from `store/src/*.html`)

| Field | File | Size |
|---|---|---|
| Store icon | `store/icon-128.png` | 128×128 |
| Screenshot 1 | `store/screenshot-01-continue.png` — hit the limit, pass the whole chat and files to the AI suggested for the task | 1280×800 |
| Screenshot 2 | `store/screenshot-02-whole-chat.png` — arrives as a draft with the full chat and your upload attached, capture check shown; you press Send | 1280×800 |
| Screenshot 3 | `store/screenshot-03-check.png` — Baton checks the next AI's first reply and offers a correction | 1280×800 |
| Screenshot 4 | `store/screenshot-04-usage.png` — usage bar, long-chat tip and all six AIs | 1280×800 |
| Screenshot 5 | `store/screenshot-05-private.png` — privacy | 1280×800 |

The screenshots are designed scenes rendered from `store/src/*.html` (`npm run render:store`). Their wording is the extension's own, and screenshot 3's card shows exactly what Baton's reply check returns for the reply in the scene.
| Small promo tile | `store/promo-small-440x280.png` | 440×280 |
| Marquee promo tile | `store/promo-marquee-1400x560.png` | 1400×560 |

**Website:** https://oscar-man-shrestha.github.io/Baton/ · **Support:** batonforai@gmail.com

## Privacy practices tab

**Single purpose**

```
Baton lets you continue an AI chat in another AI chat service: it saves the conversation from the supported AI chat site you are on and, when you choose, opens another supported AI chat with that conversation as an unsent draft, showing each service's usage limits so you know when and where to continue.
```

**Permission justifications**

| Permission | Justification to paste |
|---|---|
| `storage` | Keeps the user's saved chats (batons), summaries, settings and usage readings in the browser on their device. |
| `activeTab` | Connects Baton to the AI chat tab the user is using when they open Baton's popup. |
| `scripting` | Starts Baton's packaged content script on an AI chat tab that was already open before Baton was installed or updated, so the user does not have to reload the page. No remote code. |
| `sidePanel` | Opens Baton's library in the browser side panel when the user asks. |
| `alarms` | Schedules the delayed usage refresh after the user sends a message and the reset reminders the user asks for. |
| `offscreen` | Runs Baton's bundled on-device model (all-MiniLM-L6-v2, WebAssembly) in a hidden extension page to suggest which AI fits a prompt. Nothing is sent anywhere. |
| `contextMenus` | Adds one right-click item, "Save selection as a baton", on the six AI chat sites. |
| `identity` | Optional Google sign-in, used only when the user chooses to back up their batons. |
| Host permissions (chatgpt.com, claude.ai, gemini.google.com, chat.deepseek.com, grok.com, www.perplexity.ai) | Reads the conversation and usage figures on these AI sites, types the reviewed draft into the chosen AI's chat box and attaches the user's files there. No other website is accessed. |
| Host permission `qeoduozlznznptwsfzbt.supabase.co` | Baton's own backend, used only for the optional backup the user starts and for feedback the user chooses to send. |
| `notifications` (optional) | Requested only when the user turns on desktop usage alerts. |

**Remote code:** No, I am not using remote code. (All JavaScript and the WebAssembly model are in the package. `wasm-unsafe-eval` in the extension pages' CSP is needed only to run the bundled WebAssembly model.)

**Data usage** (what the form calls "collected" = sent off the device)

| Data type | Tick? | Why |
|---|---|---|
| Website content | **Yes** | Chat text is sent to Baton's Supabase backend only when the user chooses Back up now; drafts and files go to the AI service the user picks. |
| Personally identifiable information | **Yes** | Google sign-in for the optional backup provides the account email. |
| Authentication information | No | Baton never reads passwords or cookies; Google sign-in is handled by Google's own window. |
| Personal communications | No | (Chats with AI services are declared under website content.) |
| Health, financial, location, web history, user activity | No | Not collected. |

Certify all three statements: data is not sold to third parties; not used or transferred for purposes unrelated to the single purpose; not used to determine creditworthiness or for lending.

**Privacy policy URL:** `https://github.com/Oscar-man-shrestha/Baton/blob/main/PRIVACY.md` (the repository must be public, and `PRIVACY.md` on `main`).

## Distribution tab

Visibility **Public**, all regions, free. (Unlisted first is a good way to try the store build with a few people.)

## Test instructions for the reviewer (optional field)

```
No account is needed. Open https://chatgpt.com (signed in or not), send a message, then click the glowing Baton button next to the chat box and pick another AI: it opens with the conversation typed in as an unsent draft. The toolbar icon opens the library and usage view. Optional Google sign-in is only for backup.
```
