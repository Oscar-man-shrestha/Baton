# Changelog

All notable changes to Baton Pass, newest first. Each version was released from this repository; dates and verification notes are in the entries.

## 1.1.0 — lossless capture, files in handoffs, reply check, saved selections, shortcuts

- **Save just the part you need.** Select some of a conversation on any of the six AI sites and a small **Save as baton** button appears by it (for a few words or more). A long chat can become one baton per topic.
  - The card shows what will be saved (messages, characters, a short preview), a name you can edit and, if you have folders, a folder.
  - A selection that starts in a reply also keeps the question it answers, so the baton is named after it, has a goal, and the next AI knows what was asked.
  - After **Save**, the card lists the other AIs, ranked like the Pass menu, with an optional **What's next?**. Picking one opens it with the part as an unsent draft; you press Send. Too long to type in for you, it is copied and the AI opens for you to paste it.
  - Also from the right-click menu (**Save selection as a baton**) and the keyboard. Turn the button off under **Show on AI chat pages → Save selection**.
  - Saved like captured chats (same format): it lists, files into folders and passes like any baton. The chat it came from stays in Recent.
- **Keyboard shortcuts.** ⌘⇧U / Ctrl+Shift+U opens the Pass menu, ⌘⇧K / Ctrl+Shift+K keeps the chat as a baton (the toast says how many messages), ⌘⇧X / Ctrl+Shift+X saves the selection, ⌘⇧E / Ctrl+Shift+E opens Baton. The side panel has no default key; set one under **Change shortcuts**.
  - Letters chosen to avoid the browser's and the chat sites' own keys; checked in Brave on macOS, which refuses ⌘⇧P, F, H and J.
  - Listed with one keycap per key in Baton (**Keyboard shortcuts**) and in the guide, with a **Change shortcuts** button. The chat page shows the keys the browser actually assigned.
  - Browsers apply suggested keys only on a fresh install. An existing install keeps its keys; set them at chrome://extensions/shortcuts.
- **Usage card.** A status box says in plain words whether Baton's last check found new figures ("No new figures since 16:21 · next check 20:22"). **Details** lists each check as rows: asked from where, replies (only when one failed), what came back in one sentence (the service's field names in a tooltip) and the next try.
- **Better handoffs, measured.** A new offline benchmark (`npm run eval:handoff`, see evaluation/README.md) checks which must-keep facts of six conversations reach the draft. Baton's one-click draft went from 80% to 98%:
  - **The whole chat when it fits.** One click (the Pass menu, the rescue card, ⌘⇧K) now sends every message when the chat fits the 1,500-token draft budget, and the compact brief only when it doesn't. The popup already did this.
  - **Everything you said, in order.** The brief lists each of your messages (shortened, oldest trimmed first when space runs out): that's where goals, constraints, choices and rejections live.
  - **Rejections are kept** ("no Redux", "skip the JR pass", "that didn't change anything"), so the next AI doesn't suggest them again.
  - **Earlier replies count too:** the best point of each earlier reply, newest first, favouring names of things built (`unique_target`, `moves.log`); the latest three code blocks of the whole chat; wording you approved ("keep it exactly"), word for word.
  - Open tasks are only the asks in your latest message (older ones were answered).
  - **Live check, ready to run:** `evaluation/live/drafts/` has the six one-click drafts to paste into two AIs; `npm run eval` scores their replies (expected points, plus flags for suggesting rejected approaches, banned words, deleting files, acknowledging only, or asking again for context). See evaluation/README.md, “Live check”.
- **Research-backed handoff upgrades** (full report: reports/AI chat handoff best methods.md, from a study of 17 competing tools, compaction prompts of Codex, Gemini CLI, Cline, Roo and Claude Code, and the research on context compression):
  - **Sends far more.** The one-click draft limit was 1,500 tokens; it is now about 6,000 per AI, measured in Brave: ChatGPT and Grok took 120,000+ characters, Perplexity 60,000+, Gemini stops at 32,000 (its limit is 30,000 characters). Most chats now go whole; the compact brief (now up to 3,000 tokens) is for long ones. Evidence: full context beats extracted facts (Mem0 72.9 vs 66.9), raw turns beat summaries (LongMemEval).
  - **Exact names and figures, kept verbatim.** File names, functions, paths, links, amounts and versions from the whole chat are collected by code into one list, so the summary can't lose or reword them (the weakest point of every summarizer in Factory's evaluation).
  - **A visible capture check.** "12 messages (6 yours, 6 replies), in order", or where a message may be missing, in the popup, the toasts and the draft itself (missing messages are the top complaint about rival tools).
  - **Sturdier instructions for the next AI:** pick up where the work stopped, don't summarize back or just acknowledge, don't suggest what the user turned down, ask one short question only if something essential is unclear, and use the context where relevant. Drafts made by 1.0 are still recognised.
  - **Never lose a draft:** it is copied to the clipboard before the next AI opens, so a sign-in screen or a page that refuses the text can't lose it.
  - **Fixed: Perplexity got every draft twice** (its editor took Baton's extra input event as a second paste), and **Baton re-inserted drafts up to 12 times** on rich editors whose line breaks never matched exactly; it now compares the words, after the editor has updated. Checked in Brave: a real multi-line draft lands on the first try in ChatGPT, Gemini, Grok and Perplexity.
  - Benchmark: the one-click draft now keeps 100% of the must-keep facts (98% before these changes, 80% before 1.1.0); the compact brief alone 99%. The long test chat is now 15,800 tokens, so the summary is really tested.
- **Baton checks the next AI's first reply.** After you pass a chat and send it, Baton waits for the new AI's first reply and compares it with the handoff, on your device. No other handoff tool looks past the paste. It looks for: an approach you turned down suggested again, a rule you set possibly broken, your latest request not taken up, context the handoff already gave being asked for again, and a reply that only acknowledges. If something slipped, a card lists it (worded as “may”, since these are text heuristics) with **Put a correction in the chat box**: only the missed points, typed in for you to read and send, or copied if you've started typing. If nothing slipped: a short “✓ picked up the handoff”. Checked on two real replies from your own tests (no false alarms) and end to end through the extension in Brave.
- **Checked on real accounts: Grok chat addresses and ChatGPT writing blocks.** Grok chats are at grok.com/c/<id>, as Baton expected; the `?rid=` Grok adds (the reply on screen) now decides which branch of a regenerated chat is captured. ChatGPT has retired canvas: asked for one, it answers with a writing block inside the reply (`:::writing{…}`), which Baton captures with the reply and now shows as a plain titled block. The canvas reader stays for older chats.
- **The reply check catches changed numbers.** Figures you settled with a name (“Kyoto 4 nights, Kanazawa 3, Takayama 2”) are kept, your latest word winning, and a reply that gives one a different number is flagged: “It may have a number wrong: it says ‘three nights in Takayama’; the chat settled on 2 nights.” The correction puts it right (“Takayama: 2 nights, as we settled (not 3)”). Bare numbers (“under 700 words”) and new figures for other things are not flagged. On the 12 real replies it flags exactly the one real slip (ChatGPT's Takayama) and nothing else.
- **Any length can be passed.** Nothing refuses a long chat any more. Measured how much each AI's chat box takes at once on signed-in accounts: DeepSeek 200,000+ characters, ChatGPT and Grok 120,000+, Claude 100,000+, Perplexity 60,000+, Gemini about 32,000. A chat that fits is typed whole; a longer one goes as a summary with the whole chat attached; the side panel says which will happen instead of warning.
- **A clearer whole-chat handoff.** Speakers are “User” and “Assistant (ChatGPT)”, never “You” (which the next AI could take for itself); the source AI is named; for long chats the key points (goal, rules, decisions, turned-down ideas, exact names) come first and the latest request is repeated at the end, since models read the start and end of a long input best (Liu et al., “Lost in the Middle”). The next AI is told it may not have the earlier assistant's tools, so it doesn't pretend to run commands (DeepSeek did, after a Claude coding chat).
- **Usage from Grok and Perplexity, as they report it.** Both publish exact counts: Grok per model over 24 hours (“Grok 4: 7 left”, “Grok 3: 30 left”), Perplexity its free questions and Pro searches. Baton read neither before and counted your messages instead. Running out of one Grok model, or of Pro searches, no longer marks the AI as out. Checked against live answers from all six AIs.
- **Fixed:** the side panel could scroll and leave an empty gap below its footer; a capture of the stored chat no longer says “possible gaps” left over from an older capture.
- **Code and documents the AI made travel too, in their real final state.** Files an AI wrote in a side panel or as output were not in the chat text, so a handoff said “here's your updated component” without the component.
  - **Claude:** the chat's output files go along as themselves, fetched from Claude in their final state when you pass. Checked on real chats: `retro-portfolio.html` arrives as the real 73 KB file; replaying the chat's file edits would have given 31k characters, because Claude later patched it with scripts. Files Claude presented to you go first; empty files are skipped. Where Claude serves no files (older chats, the classic artifacts format), the file is rebuilt by replaying its creation and every edit, and labelled “as written in the chat; a later command may have changed it” when a command touched it afterwards.
  - **ChatGPT canvas:** the document is rebuilt from its creation and every canvas edit, which is exact.
  - Small files (up to 6,000 characters) go inline as a code block on the message where they last changed, so summaries and the full-chat file keep them; larger ones are attached.
- **Proven on real AIs, then sharpened** (live run, 2026-10-24; results in evaluation/README.md). Six handoff drafts went to ChatGPT and Claude; all 12 first replies continued the work with the user's decisions (11 of 12 pass the scorer). What the run and a last end-to-end check through the built extension fixed:
  - The reply check flagged 8 of 12 good replies (wrong key words such as “the” and “CLI”; any “delete” counted as breaking “never delete”). Now 0, with real slips still caught; a point is reported once, as a rule where it is one, so a card no longer says “server” and “Redux” twice.
  - Summaries of very long chats no longer repeat a question 14 times, take a problem for a rejected idea, or keep fragment “exact details”; the long test chat's summary went from 3,128 to 1,321 tokens at the same 100% benchmark score, and opens with what it was made from (“Made from: 85 messages (43 yours, 42 replies), in order”).
  - The attached full chat is named after what the chat is about when the page title is only the AI's name (“Build a todo app for my phone - full chat.md”, not “ChatGPT Chat, Work, Create & Code with AI - full chat.md”).
- **Files travel with the handoff.** When you pass a chat with the Baton button, the next AI's chat box gets the draft plus files, never sent:
  - **The complete chat as a Markdown file** (“<chat title> - full chat.md”) whenever the chat is too long to type in whole, so the summary is typed and nothing is lost; the draft points the next AI to it.
  - **Your uploaded files, re-attached.** Fetched from the source chat with your own session there: ChatGPT originals (its download link), Claude text documents exactly and images as Claude's full-size preview, Grok originals, Perplexity attachment links. DeepSeek and Gemini don't serve uploads back, so those stay named only. Newest first, up to 8 files, 10 MB each, 20 MB in all; anything left out is named in the status.
  - Attaching measured on real accounts: ChatGPT, Gemini, DeepSeek and Perplexity take a pasted file; Claude takes its file input. Checked that the typed draft stays when the files arrive. Grok untested (its terms screen blocked the test account).
- **Long-chat tip.** When a chat reaches about 30k tokens or 60 messages, a card above the chat box suggests a fresh chat that starts from a handoff (more firmly from about 80k tokens or 120 messages): **Fresh chat in <same AI>**, **Pass to another AI**, or **Not now** (asks again when the chat is half as long again). Measured on the whole stored chat, at most once a minute; a limit card always takes its place. Switch: **Long-chat tip** under Show on AI chat pages. Why these sizes: NoLiMa (2025) found most models at half their short-chat accuracy by 32k tokens; Chroma's context-rot study (2025) found every model degrades as input grows; Laban et al. (2025) measured a 39% drop when a task is spread over many turns.
- **Lossless capture on all six services** (ChatGPT, Claude, Gemini, DeepSeek, Grok, Perplexity). Checked on real chats: a 162-message DeepSeek chat, a 58-message Grok chat with a regenerated reply, a 16-message Perplexity thread, and Gemini, Claude and ChatGPT chats, each read whole, in order, on the branch shown, with uploaded and generated files named. Baton now reads the chat as the service stores it (same site, your own session, nothing leaves the browser), instead of only what the page shows. Found on a real Claude chat: the page renders only the messages near the screen (the opening prompt wasn't there), and replies that used tools were cut to their first line. The stored chat has every message, every part of every reply, only the branch you're looking at, and no thinking, tool steps or hidden system messages. The page reading remains the fallback.
  - **Files are named.** Files you uploaded and files the AI made (like a ZIP from Claude) are listed in the handoff, and the next AI is told to ask you for any it needs.
  - Claude's page changed its reply marker (`assistant-message`); added to the selectors (version 8), so the fallback works too.
- **Have this AI write the handoff (opt-in).** In the Pass menu, **Have ChatGPT write the handoff** (or Claude, Gemini…) types a request into the current chat asking for a handoff with fixed sections (goal, constraints, decisions, rejected, current state, artifacts verbatim, exact details, open questions, next step with your latest request quoted). You read it and press Send; Baton never sends.
  - When the reply is complete, Baton checks it against the exact names and figures it collected from the chat, adds back any the AI left out (verbatim) and your latest request if it wasn't quoted, says how it did ("kept 23 of 25… Baton added the other 2 back"), saves it as a baton and offers the next AI.
  - Your own unsent text in the chat box is never replaced: then the request is copied for you to paste. Later captures of the chat leave the request and its reply out.
  - Also a keyboard action (no default key; set one under Change shortcuts). Idea from FreshContext; checking the summary against the chat is Baton's own, because model summaries invent or drop details.
  - Checked in Brave on ChatGPT, Gemini and Perplexity with a simulated reply: request in the chat box, reply found when complete, the missing name added back, baton saved, next AIs offered.
- **New permission:** `contextMenus`, for the one right-click item. Chrome shows no install warning for it. STORE_LISTING.md and PRIVACY.md describe it.
- Tests: selection reading on all six sites, question context, naming, storage format, shortcut keys and formatting, usage-check wording. Checked in Brave (headless, signed out, with an injected test conversation): save from the button, typing a name (no keys leak into the chat box), pass to the next AI, shortcuts and right-click.

## 1.0.0 — ready for the Chrome Web Store

- **New logo:** the old Handoff arrow is replaced by Baton's own mark, a glowing violet tile with a striped baton passed across it. It matches the pass button, the site and the store images.
  - Sizes: 16, 32, 48 and 128 px. The 16 and 32 px icons use a simpler, bolder version so they stay clear in the toolbar. The 128 px icon has the store's 16 px transparent margin.
  - The manifest's toolbar icon uses the new sizes, the extension pages and the website have favicons, and `store/icon-128.png` is the store icon.
  - Rendered from `store/src/icon*.svg` with `npm run render:icons`.
- **No more "Read your browsing history" warning:** the `tabs` permission is gone. Baton only reads the addresses of the six AI sites, which its site access already allows. The browser test checks that Baton still sees its AI tabs and can't see other addresses. STORE_LISTING.md is updated.
- **ChatGPT's usage bar is honest:** free ChatGPT text chat has no published cap, so the bar no longer shows "4 msgs in last 5 h" (a window that suggested a limit). It now says "**Chat · No cap · 4 sent today**". The usage card and the Other AIs row say "No chat cap · 4 sent today". If ChatGPT ever shows a limit message, Baton learns it and switches to "≈N left".
- ChatGPT's banked limit resets are now read as "**Banked limit resets**", so "0 left" no longer looks like a broken chat limit.
- **First-use tour:** the first time Baton appears on an AI chat, a small card by the glowing button asks "**New to Baton?** Take a 20-second tour?" (**Show me** / **No thanks**). Nothing starts unasked.
  - Three steps, each ringing the real element: the glowing button (continue in another AI), the usage bar (what's left, × to hide), then "You stay in control" (you press Send; the toolbar icon has every AI's usage and your batons).
  - Back, Next, Done and **Try it now** (opens the menu); Escape or × ends it.
  - Once answered, it never asks again, including in other open tabs. **Take the quick tour again** in Baton's popup or side panel, or **Show me on a chat page** on the welcome page, queues it for the next chat page.
  - Clicked through in a real browser on Gemini: question → three steps → menu opens → no question after reload.
- Baton's own layers (tour card, rings, cards) no longer count as covering the chat box. Before this fix, the tour card hid the usage bar it was pointing at.
- **Delete several batons, or all of them:** the Batons list (dashboard and All Batons) has **Select**, then **Select all**, **Delete N** and **Cancel**, plus **Delete all**. Every delete, including a single ×, opens a card that says what happens first:
  - removed from this browser (saved chat text, summaries, drafts);
  - your conversations on the AIs aren't touched;
  - your Google backup isn't changed until you back up again;
  - it can't be undone, with **Download backup first** right there.

  It confirms with "N batons deleted from this browser." This replaces the plain browser confirm box.
- **Help:** a **?** button in Baton's header opens the guide.
- **Redesigned welcome page, which is also the guide:** it uses Baton's relay look with bundled fonts, so it makes no outside requests.
  - Hero with a live-looking example: chat box, usage bar, glowing button and menu. Buttons: **Show me on a chat page** (queues the tour) and **Read how it works**.
  - Three set-up steps: pin (live check), open an AI (six buttons), and find the glowing button.
  - **How to use Baton:** eight plain-words sections (pass, What's next?, the right AI, usage, another account, batons and folders, backups, hiding things).
  - **Good to know**, and a footer with settings, website, privacy policy and contact.
  - Opened from **?** as `welcome.html#guide`, it's titled "How to use Baton".
- The popup header keeps its buttons on one line; the subtitle steps aside in the narrow popup.
- **Feedback, collected properly.** One insert-only Supabase table, `baton_feedback` (`supabase/feedback.sql`), receives answers from three places:
  - **The uninstall page:** one-tap reason plus optional message, version and browser.
  - **A new Feedback page in Baton:** Something's broken, Something's confusing, An idea or I like it; which AI site; a message; and a version/browser checkbox that's on by default. It opens from **Send feedback** in the popup footer and from the guide's menu and footer.
  - **A one-time check-in after the 5th successful pass:** "How's Baton working for you? 👍 Great · 👎 Not great · Later". 👎 opens the Feedback page; Later asks again 10 passes on.

  Until the SQL is run, every screen falls back to copy or email. The public key can add rows but never read them.
- **Google Drive backup (optional):** **Back up to Drive**, **Restore from Drive** and **Disconnect Google Drive** in Backups and data.
  - It saves "Baton backup.json" in the user's own Drive with the `drive.file` scope, so Baton only sees its own file.
  - It runs in the background worker and switches on once `src/config/google.json` has an OAuth client ID.
- `SETUP_FEEDBACK_AND_DRIVE.md` has the exact one-time steps for both; PRIVACY.md and STORE_LISTING.md are updated.
- **Version 1.0.0**, with an upload zip from `npm run zip`.

Verified: 246 tests in 35 files, typecheck, complete build, browser smoke test (see the commit), build-1 synced.

## 0.3.49 — ChatGPT Work and credits stay visible

- **The bug:** ChatGPT's Work/Codex allowances and credits disappeared from Baton about an hour after Baton last read ChatGPT's usage page. All service readings were hidden after one hour. That's right for chat limits, which move with every message, but too strict for weekly allowances and credit balances.
- **Now:** readings that aren't chat limits (Work/Codex, credits, banked resets, feature caps) stay visible for **24 hours**, labelled with the time they were read. They still go away as soon as their reset time passes. Chat limits keep the one-hour rule. Both behaviours are covered by tests.
- **Fixed a time-dependent test:** `composerStatusText` read the real clock, so a test written for 12:00 UTC failed later in the day. The function now takes the current time as an input (defaulting to the real clock).

Verified: 245 tests, typecheck, complete build; build-1 synced. Still to check with a signed-in ChatGPT: whether ChatGPT's redesigned page (new Chat | Work switch) still lets Baton read the usage page. Press **Read usage ↗** in the ChatGPT usage card. If Work and credits reappear, the reader is fine.

## 0.3.48 — a tidy ChatGPT usage row

- **Usage rows are about chat only.** ChatGPT's row used to read "Chat: no limit shown · Work weekly 100% left · Credits 2,500 left · Limit resets 0 left · Work 5-hour 100% left". It now reads "**Chat: no limit shown**" with a small "**＋ Work & credits**" note. Hovering or focusing the note lists the other allowances, one per line. Other services with non-chat allowances get "＋ Other limits".
- "Limit resets 0 left" (ChatGPT's banked limit resets) is now called "**Banked limit resets: 0**", and only in the note.
- `laneFor` returns the chat detail and a separate `extras` list. Tests are updated, plus a new one for the banked resets wording.

Verified: 243 tests, typecheck, complete build; the usage list rendered in the built extension with sample ChatGPT and Claude readings. build-1 synced.

## 0.3.47 — "What's next?" in the pass menu

- The glowing button's menu has a **What's next? (optional)** line under the task chips.
  - Whatever you type is added to the end of the draft as "Next task from the user: …", so the next AI starts on the right step with full context.
  - Personal data and keys are redacted. The step is capped at 300 characters in the box and 500 in the draft.
- **Pre-filled:** on a fresh open, the line starts with any unsent text in the chat box, which is usually the next step. You can edit or clear it.
- **Enter** in the line passes to the Suggested AI, and **Escape** closes the menu. Keys typed there stay in Baton's box, so the chat site doesn't react.
- **The step goes with every action:** passing to an AI, Copy project, and "…, another account", where it's kept in the waiting project.
- **Typing isn't interrupted:** if you start typing before the on-device model answers, the menu doesn't re-rank under you.
- Baton's side panel ("Pass the baton to") has the same line. Pass → and "another account" from there include it.

Verified: 242 tests in 35 files (`withNextStep`: adds, skips empty, tidies, caps, redacts), typecheck, complete build. Browser smoke test: the menu shows the line pre-filled with the typed prompt, and all earlier checks still pass. build-1 synced. Not checked live: a pass from a signed-in chat with a next step.

## 0.3.46 — fixes from a full browser test

A new end-to-end test (`npm run smoke`) loads the built extension into a clean, throwaway Brave profile and checks everything that works without signing in. It never signs in and never sends a message.

**Passed:**
- The welcome page opens on install.
- The popup loads with no errors: Sign in button, both chat-page switches on, Other AIs closed.
- The switches save their setting.
- The on-device model answers through the real background and offscreen page: about 1.4–3 s the first time, then about 20–30 ms per prompt.
- The online rankings download from GitHub.
- The settings editor shows six AIs.
- The usage bar and glowing button appear on Gemini, Grok and Perplexity.
- The Baton menu opens and reads the typed prompt ("Looks like code", based on what's typed).
- × hides the bar and saves the setting.
- With a project waiting, the sign-in ring circles "Continue with Google" on Claude and "Log in" on ChatGPT.

**Fixed:**
- **ChatGPT's newer chat box was not recognised.** Signed out, ChatGPT now uses a plain `textarea name="prompt"` (`#mobile-composer-prompt`), so Baton showed nothing there. The selectors now include it (selector set v7). If ChatGPT rolls this design out to signed-in users, Baton keeps working.
- **The glowing button could sit on a site's pop-up.** On Perplexity it landed on the sign-in sheet that appears after load. The free-space check now looks through Baton's own elements and treats floating layers (dialogs and fixed pop-ups) as taken. The button moves above the chat box instead.
- **A growing usage bar could overlap a neighbour.** The check now always samples the right edge, so on ChatGPT the bar drops below the suggestion chips.
- **The sign-in tip could land off screen.** When the button sits at the top (ChatGPT's "Log in"), the tip now goes below it.

Not testable without signing in, and covered by unit tests instead: usage readings, capture, the pass flow, and drafts in a logged-in chat.

## 0.3.45 — one-tap log-out for "another account"

You asked for this to save time: "another account" can now log you out of the AI for you.

- **ChatGPT, Claude, Grok:**
  - After saving your project, Baton asks: "Log out of ChatGPT now so you can pick another account? Other ChatGPT tabs will be logged out too."
  - On OK it opens the service's own log-out page. Checked 2026-10-22 while signed out: `chatgpt.com/auth/logout` returns to the signed-out home, `claude.ai/logout` lands on Claude's sign-in page, and `grok.com/sign-out` goes to X's sign-out.
  - On Cancel you get the manual steps.
- **Perplexity and DeepSeek:** no reliable log-out link, so they keep the guided steps.
- **Gemini:** unchanged. Google's account chooser opens directly, and no log-out is needed.
- **Sign-in highlight:** while a project is waiting and the AI's page is signed out, Baton puts a glowing ring around "**Continue with Google**", or "**Log in**" where that comes first, with a one-line tip. Pressing it opens Google's account chooser. After you sign in, the "Continue your project here?" card takes over.
- Baton still never types passwords, reads account details or cookies, or signs anyone in. The privacy policy has a new "Switching account in the same AI" section.

Verified: 239 tests in 34 files (log-out pages, sign-in button matching), typecheck, complete build; build-1 synced. Not checked live: logging out of a signed-in account, and the highlight on each site's sign-in page.

## 0.3.44 — same AI, another account

People with several Google accounts can keep using the AI they like: switch account, and the project is waiting.

- **One button, four places:**
  - "**ChatGPT, another account**" in the glowing button's menu;
  - on the limit card;
  - in Baton's "Pass the baton to" section;
  - after Capture: "Continue in ChatGPT with another account".
- **What it does:**
  1. Saves the project as a baton, and as a waiting project for that AI for six hours.
  2. Shows where to switch, in the service's own screens. For example, ChatGPT: profile picture (bottom left) → Log out, then sign in with the other account.
  3. On Gemini it opens Google's own account chooser, so several accounts can stay signed in and no sign-out is needed.
- **Continue here?** When you open a new chat on that AI (not the one you came from, and before you've sent anything), a small card offers "**Continue your project here?** · Continue · Not now".
  - Continue: puts the project in as a draft, and you press Send. If the site blocks typing, it copies the project instead.
  - Not now: forgets the waiting project. The baton stays saved.
- Baton still never signs anyone in or out and reads no account details. It offers the project on the next fresh chat, which works whichever account you switch to.
- The old "Switch account" help text is replaced by this flow (`src/core/account-continue.ts`, with tests).

Verified: 237 tests in 34 files, typecheck, complete build; build-1 synced. Not checked live: the card after a real account switch on each site.

## 0.3.43 — calmer usage list, bolder pass button

- **Other AIs** in the usage section now always starts closed. Its summary line still shows the top two; open it when you want the full list, and it stays open while Baton is open.
- **The glowing pass button** by Send is bigger (40 px, was 34 px), with a stronger steady glow in dark and light themes and a brighter hover. It breathes four times when it appears, then stays still; no animation with reduced motion. Its placement uses the new size, so it still keeps clear of the site's controls and the usage bar.

Verified: tests, typecheck, build; build-1 synced. Not checked live: the new size on each site.

## 0.3.42 — contact email

- `batonforai@gmail.com` is the contact for Baton. It appears in:
  - the landing page footer (with a Copy button);
  - a new FAQ, "How do I contact you?";
  - the welcome page;
  - the privacy policy;
  - the store listing notes.
- Uninstall page: until the Google Form is connected, the thank-you message asks people to email their answer, with a Copy button and an "open in your email app" link that pre-fills it.

Verified: 234 tests, typecheck, build, page scripts parse; build-1 synced.

## 0.3.41 — welcome page, uninstall feedback, store images

- **Welcome page after install** (`welcome.html`): it opens once, on first install, and walks through three steps.
  1. **Pin Baton.** Chrome reports whether Baton is pinned, and the step turns green as soon as you pin it.
  2. **Open an AI chat.** One button for each of the six services.
  3. **Find the glowing button by Send.** An example of the chat box with the usage bar and button, and how to hide them.

  It ends with "Good to know" (you press Send, saved on this device, real numbers only, private suggestions) and links to settings, the site and the privacy policy. It uses system fonts only; no external requests.
- **Uninstall feedback page:** when Baton is removed, the browser opens `oscar-man-shrestha.github.io/handoff/uninstall.html?v=<version>`.
  - One-tap reasons. Three of them show an instant fix: hide the button instead, how to use it, and what Baton can access.
  - An optional text box.
  - Sending works once a Google Form is connected (two settings at the top of the page). Until then the page offers "Copy my feedback".
  - Only the reason, the typed text and the version are sent. PRIVACY.md is updated.
- **Chrome Web Store images:** five 1280×800 screenshots, a 440×280 small promo tile and a 1400×560 marquee in `store/`. They are rendered pixel-exact from `store/src/*.html` with `npm run render:store` (puppeteer-core 25.11.0 driving the local Brave; no browser download). STORE_LISTING.md lists which file goes where, plus a suggested store name and summary.

Verified: 234 tests in 33 files, typecheck, complete build; the welcome page and uninstall flow clicked through in a browser; all seven images checked at their exact sizes; build-1 synced with the completeness guard. Not checked live: the welcome tab opening on a real first install, and the uninstall page opening on a real removal.

## 0.3.40 — clearer words, a glowing pass button, and sign-in at the top

Feedback from a first-time user: "Folder" and the "Baton button" switch were confusing, sign-in was hidden, and the button by Send was easy to miss.

- **Clear names and help text:**
  - "New Baton" → **Write a baton** (write or paste your own context).
  - "Folder" → **New folder**. A line under the buttons says what Capture and folders do, and the folder dialog gives examples (School, Work).
  - "On chat pages" → **Show on AI chat pages**, with a line under each switch:
    - *Usage bar*: how much you have left, under the chat box;
    - *Pass button*: the glowing button by Send that moves your chat to another AI.
  - Tooltips on the page point to the new section name.
- **Glowing pass button:** 34 px (was 28 px), with a violet gradient and a soft halo. It breathes three times when it appears, then stays still. It's brighter on hover, and doesn't animate when reduced motion is on. Its placement uses the new size, so it still keeps clear of the site's own controls and the usage bar.
- **Account at the top right:**
  - Signed out: a **Sign in** button (Google).
  - Signed in: your **Google profile photo** (or your initial). Its menu shows your name and email, the last backup time, **Back up now**, **Switch account** (Google's own account chooser), **Backups and data**, and **Sign out**.
  - "Disconnect" is now called **Sign out**. Signing out or switching keeps your local batons and your cloud backup.
- Popup layout: Capture gets the full row; the other two buttons share the next row.

Verified: 234 tests in 33 files, typecheck, complete build, the popup rendered from the built files (header, buttons, switches); build-1 synced with the completeness guard. Not checked live: Google sign-in and the avatar menu with a real account, and the glow on each site.

## 0.3.39 — suggestions from your latest message, and in the side panel

- **Your latest message decides the task.** On DeepSeek, "write a meme of my cat" was ranked as **code**. The guess had included the reply's code block (the text meme), which scored 10 for code. The guess now uses only the text in the box, or else your latest message. Replies and older messages no longer count.
- **DeepSeek replies are recognised more reliably.** A turn that contains rendered markdown, a code block, a table or a "thinking" section is read as a reply. Your own messages are plain text. Covered by a new test.
- **The menu shows what it used:** "Based on: “write a meme of my cat”", so a wrong guess is easy to spot and fix with a task chip.
- **"Pass the baton to" in Baton's side panel and popup:** it sits above Usage and needs no Capture first.
  - It shows the best three AIs for this chat, with the task, what the guess is based on, task chips and a reason for each.
  - **Pass →** saves the baton and opens that AI with your project as an unsent draft, the same action as the Baton button. It also counts as a pick for that task.
  - It refreshes when you switch chats, when you come back to Baton, and every 15 s while Baton is open.
- "make a meme / gif" now reads as images; "write a meme" stays writing.

Verified: 234 tests in 33 files, typecheck, complete build; build-1 synced with the completeness guard. Not checked live: the side panel section and Pass → on each site.

## 0.3.38 — on-device AI model for the task check

- **On-device model:** the task check now has a small open-source language model behind the keywords: all-MiniLM-L6-v2 (Apache-2.0, 23 MB quantized) running in ONNX Runtime Web (MIT). It's free and permanent, and works offline, with no API, key, account or download at run time. Baton's own topic layer (7×384 weights, `src/model/topic-head.json`) is trained on 637 labelled prompts by `scripts/train-topic-head.ts`.
- **How they work together:** keywords decide when they're sure. Otherwise the model decides when it is at least 40% sure. Otherwise Baton uses the everyday order. The model is used in the Baton menu (the menu opens instantly and re-ranks once the model answers, unless you've tapped a task), the limit rescue card, and the popup's capture flow. If the model is unavailable, keywords still work as before.
- **Accuracy, measured honestly** on 50 prompts written before training and never trained or tuned on:
  - keywords 39/50 (78%);
  - model alone 46/50 (92%, 4 wrong topics);
  - **combined 46/50 (92%, 1 wrong topic)**.
  - 5-fold cross-validation on training prompts: 90%.
  - A test locks in at least 90% and at most 2 wrong topics.
- **Speed (checked in Chromium on the built files):** about 1.6 s for the first answer (model load), then about 40 ms per prompt. The hidden page closes after 2 idle minutes.
- **Correctness:** Baton's tokenizer matches transformers.js token-for-token on test strings, including punctuation, accents, Chinese characters and emoji. Embeddings agree to within 0.5% (`npm run check:embed`).
- **Manifest:**
  - new `offscreen` permission (Chrome shows no install warning for it);
  - content security policy `script-src 'self' 'wasm-unsafe-eval'` so the WebAssembly engine can run (still no remote code);
  - the extension grows from about 9 MB to about 47 MB.
- **Docs and licences:** third-party notices (MIT, Apache-2.0), PRIVACY.md and the store permission justifications are updated.

Verified: 233 tests in 33 files, typecheck, complete build, model run in Chromium from the built files; build-1 synced with the completeness guard. Not checked live: the offscreen page inside the installed extension in Brave.

## 0.3.37 — rankings for today's free tiers, stronger task check

- **Rankings v2 (`rankings.json`):** re-ranked for what each service gives free users in October 2026, with the evidence and links in RANKINGS.md.
  - Gemini drops for code, research and maths: since 9 Oct the free app mostly runs Flash-Lite.
  - Gemini is now first for images: it is the most generous free image maker.
  - ChatGPT is first for everyday use (no cap on free text chat) and second for research (top-rated web search).
  - DeepSeek stays first for maths and second for code.
  - Perplexity stays first for research and news (every free answer is cited).
  - Reasons were updated to match. This file is also the online copy, so installed 0.3.36 users get it within a day.
- **Stronger task check:** weighted cues instead of word counts.
  - Strong signs outweigh shared words like "write", "latest" and "compare". Strong signs are a code block, a stack trace, a file name, "generate an image of…", "% of", "new prime minister", and similar.
  - Vocabulary is much wider, including casual phrasing ("can u fix my code").
  - "Asking about a picture" is no longer "make a picture". Time words alone ("dinner tonight") no longer mean news.
  - A prompt with no clear sign gets the everyday order.
- **Measured honestly:**
  - 217 labelled prompts that the cues were tuned on: 216 right.
  - 40 fresh prompts never used for tuning (`tests/fixtures/topic-heldout.json`): 28 right (70%). All 12 misses fell back to "general", none to a wrong topic. A test keeps both properties.
- **Fix the guess in one tap:** the Baton menu shows task chips (Code, Research, Current events, Writing, Maths, Images, General). Tapping one re-ranks the list, and the pick you then make counts for that task.

Verified: 231 tests in 33 files, typecheck, complete build; build-1 synced with the completeness guard. Not checked live: the chips and the new order on each site.

## 0.3.36 — suggestion rankings that update online

- **One list for every suggestion:** the Baton menu, the limit rescue card and the popup's capture flow now share the same suggestions: the task's topic, then Baton's rankings, then your order and picks, then usage left. The older five-intent router (`router.ts`) and its per-service intent checkboxes have been removed.
- **Updates without a release:** `rankings.json` in the repository is bundled with Baton and also downloaded once a day from GitHub (`raw.githubusercontent.com`, a plain request with no cookies). When a model gets better at something, editing that file changes suggestions for every user within a day. The file is validated, and Baton falls back to its built-in list when the online file is broken, missing or older. It can also add topic keywords. See RANKINGS.md.
- **Your own order:** Settings → Services and suggestions → "Best AI for each kind of task". Pick a task and move AIs up or down. The buttons are "Use Baton's order", "Forget my picks" and "Check for updates". The section says whether the online list or the built-in one is in use.
- **Learns from you:** each pass from the Baton menu, and each 👍 or 👎 in the popup, nudges that AI for that kind of task, by at most three places. This is stored only in this browser.
- No new permissions: GitHub serves the file to any site, so no host access is needed.

Verified: 229 tests in 33 files, typecheck, complete build; build-1 synced with the completeness guard. Not checked live: the daily download (the file is live only after this push), the Settings editor, and the suggestions on each site.

## 0.3.35 — reliable ×, visible switches, suggestions by task

- **× on the usage bar works:** the pill is built once (mark, body, ×). Only its body is refilled, and only when the figures change, so streaming replies no longer replace the × mid-press. It hides the bar on press (pointerdown) as well as on click, and is more visible (70% opacity, full on hover). The pill isn't re-measured when nothing has moved.
- **Always-visible switches:** Baton's Usage section now has an **On chat pages** row with **Usage bar** and **Baton button** switches. They replace the "↺ Show…" links that only appeared after hiding. They stay in sync with the × on the bar, **Hide this button** in the Baton menu, and the Usage window switch.
- **Suggestions by prompt topic:** the Baton menu guesses the topic from the text being typed, or else from the last three questions in the chat. The topics are code, research, current events, writing, maths, images and general. It ranks the AIs for that topic, then by usage left. Services at their limit stay last, and a service under 15% left drops below ones with room. Each row says why, for example "searches the web with sources · 80% left". The guess runs on this device from keywords (no API, nothing sent). The ranking table is Baton's own judgment (`src/core/task-fit.ts`, easy to retune).

Verified: 226 tests in 33 files, typecheck, complete build; build-1 synced with the completeness guard. Not checked live: the × and switches on each site, and the topic suggestions.

## 0.3.34 — Baton button by the composer

- **Baton button:** a round button with the baton mark sits just outside the composer's bottom-right corner, under the site's Send button, and never covers the site's own controls. It tries three spots in order and stays clear of the usage pill:
  1. 5 px below the bottom-right corner;
  2. beside the box at the bottom right;
  3. above the box's right end.
  It hides when none is free of visible text and controls.
- **Menu (“Pass the baton to…”):** the other AIs ranked as in the rescue card (room left first, then no reading, then limited). The best is marked **Suggested**; a service at its limit is greyed out with its reset time. Each row has the service's colour dot and its detail (“99% left”, “no limit shown”, “≈2 of 20 left (counted)”). Picking one saves the chat as a baton and opens that AI in a new tab with the project as an unsent draft, the same action as the rescue card (now one shared `passTo`).
- Also in the menu: **Copy project** (saves a baton and copies the draft) and **Hide this button**. Hidden, it comes back with **“↺ Show the Baton button by chat boxes”** in Baton's Usage section (setting `passButtonEnabled`).
- The menu opens upwards when there is room, stays on screen, focuses the first choice, and closes on Escape or a click outside. It has a light theme and respects reduced motion.
- The usage pill and the button share one free-spot check, `spotTaken`.

Visual check: the button and open menu rendered with the shipped styles and sample data. Verified: 224 tests in 32 files, typecheck, complete build; build-1 synced with the completeness guard. Not checked live: placement on each site and the end-to-end pass from the menu.

## 0.3.33 — hide the usage bar, bring it back from Baton

- **× on the bar:** a small × at the right end of the usage pill hides it at once on every AI site. It is faint until you hover over the pill and has a focus ring for keyboard users. Its tooltip says how to bring the bar back.
- **Bring it back:** while hidden, Baton's Usage section shows **“↺ Show the usage bar under chat boxes”**. The existing “Show usage below the prompt bar” switch in the Usage window stays in sync with it. Both use the same `composerUsageEnabled` setting, and open pages update immediately.
- The pill itself now takes clicks (the space it uses is checked to be free of text and controls). It is invisible while being measured, so placement never detects itself.
- UI test: the show-bar link exists in the Usage section and is hidden by default.

Verified: 224 tests in 32 files, typecheck, complete build; build-1 synced with the completeness guard. Not checked live.

## 0.3.32 — the usage pill goes below the composer on every site

Live, on 0.3.31, with the new premium pill on all four sites: ChatGPT and Claude were below the composer. On Gemini and DeepSeek the pill went above the box and overlapped its top edge.

- **Why:** a full-width, empty wrapper around Gemini's and DeepSeek's centred disclaimers counted as “occupied”, so the spot below was rejected. The fallback above was also calculated for the old 19 px line, not the 26 px pill.
- **Now:** Baton draws the pill first and measures it, then samples points across the spot where it would sit (left to right, top, middle and bottom). A spot conflicts only if the pill would cover visible text, a control, or the composer itself; empty wrappers do not count. The spots tried, in order:
  1. 6 px below the composer, aligned with its left edge (Gemini, DeepSeek, ChatGPT: the centred disclaimers stay clear);
  2. if a row of controls sits right under the composer, 6 px below that row (Claude's Project / model row);
  3. 6 px above the composer, using the pill's real height.
  The pill hides if none of these is free or on screen.
- The old fixed-height position helpers are no longer used by the page script; their tests remain.

Verified: 224 tests in 32 files, typecheck, complete build; build-1 synced with the completeness guard. Placement depends on live page layout and is not unit-tested; needs a live check on Gemini and DeepSeek.

## 0.3.31 — premium usage pill, placed by the composer's real outline

Live, on 0.3.30: Claude's and ChatGPT's pills were right. On Gemini the pill overlapped the top edge of the composer; on DeepSeek it sat above and to the left of the box.

- **Placement:** the composer is now the outermost ancestor (up to 10 levels) that looks like a box: corner radius of 8 px or more, plus a visible background, border or shadow. It must also reach the editor's bottom, be no taller than 360 px and narrower than 95% of the window. The pill lines up with that box, below it or (fallback) above it. The old size-only rule picked Gemini's inner text field (its box is much wider than its editor) and a wider invisible wrapper on DeepSeek.
- **Premium design:**
  - frosted glass: two-tone gradient, 12 px backdrop blur, fine top highlight and a deeper soft shadow, 26 px tall;
  - a glowing baton mark;
  - small-caps labels (SESSION, WEEKLY, CHAT), with tabular, bold figures (“54%”), a lighter “left” and a muted reset (“3h 1m”) after them;
  - **ring gauges** instead of bars, filled to what is left: teal, amber under 50%, red under 20%;
  - soft gradient dividers between segments, and a matching light theme.
- Visual check: rendered at 1.8× with the shipped styles in dark and light, for the plenty, estimated low, nearly-out, counted and no-limit cases.

Verified: 224 tests in 32 files, typecheck, complete build; build-1 synced with the completeness guard. Not checked live: placement on Gemini and DeepSeek with the new rule.

## 0.3.30 — a nicer usage bar under the composer

Live, on 0.3.29: Claude's line was right (Session 37%, Weekly 19%). ChatGPT's line read “Usage left: 100% (service notice)”, which was its Work allowance again. On Gemini's single-row composer the line was drawn inside the box.

- **New design:** a compact pill with a small baton mark and one segment per limit, e.g. “Session ▰ 63% left 3h 9m | Weekly ▰ 81% left 2d 16h”.
  - Values say what is **left**, matching the sidebar.
  - Mini bars are teal with plenty left, amber under 50%, red under 20%; estimates show “≈”.
  - Thin dividers, a soft shadow, and a light version for light mode. The prompt token count is a quiet final segment while you type.
  - Built by the tested `chatSegments` helper (new `src/core/composer-line.ts`).
- **ChatGPT fallback fixed:** when there is no chat window, only a chat notice may stand in, never the Work allowance. Otherwise it shows “Chat 2 msgs in last 5 h · counted by Baton” or “Chat no limit shown”.
- **Gemini placement:** Baton now climbs up to 8 levels to the whole composer box. It accepts any box at least as low as the editor, and stops before page-wide wrappers (no wider than 1.6× the editor, or the editor plus 160 px). On Gemini's single-row composer the line now goes below the box instead of inside it.
- Three tests in `tests/composer-line.test.ts`.

Visual check: the pill was rendered with the shipped styles in dark and light, with plenty, low, nearly-out, counted and no-limit cases. Verified: 224 tests in 32 files, typecheck, complete build; build-1 synced with the completeness guard. Not checked live: placement on each site.

## 0.3.29 — chat-only line under the composer

Live, on 0.3.28: the line under ChatGPT's composer read “Work weekly 0% used · resets in 5d 7h · Credits 2500 left”. Those figures are ChatGPT's Codex/Work allowance, not chat, so under the chat box they looked like a chat limit and hid the chat message count.

- The line under the composer now shows chat usage only:
  - a service's chat windows, e.g. Claude's Session and Weekly, or Gemini's 5-hour and Weekly;
  - otherwise the chat message count, e.g. “1 msg in last 5 h (counted by Baton)”;
  - otherwise “Chat: no limit shown” when the service shows only non-chat figures.
- Codex/Work, credits, banked limit resets and feature caps (images, files, voice, deep research) stay in the sidebar card and in the line's tooltip.
- Limit notices for chat still appear in the line as before.

Verified: 221 tests in 31 files, typecheck, complete build; build-1 synced with the completeness guard. The line's logic lives in the content script and is not unit-tested; not checked live.

## 0.3.28 — ChatGPT's new page layout

Checked against a chatgpt.com conversation saved in Brave on 22 Oct 2026.

- **ChatGPT messages were no longer found.** ChatGPT's page no longer contains `data-message-author-role`, which Baton relied on, so it found no ChatGPT messages: sends were not counted (seen live: three messages, no count) and capture would have failed. ChatGPT now keys message units `…:user` / `…:assistant` (`data-chatgpt-search-unit-key`). Baton reads those and keeps the old marker as a fallback.
- **Text:** each unit opens with a hidden “You said:” / “ChatGPT said:” heading. Baton reads the user bubble (`data-user-message-bubble`) or the answer body (`data-markdown-text-style="assistant-message"`), so the headings stay out.
- **Identity:** ChatGPT's message id (`data-chatgpt-search-message-ids`) identifies each message, so two identical “hi” messages count as two.
- **Composer:** `#prompt-textarea` is gone; the composer is a labelled content-editable box, matched by the new `[contenteditable='true'][aria-label]` pattern and the existing fallback.
- **Selector bundle version 6**, so saved ChatGPT chats are rebuilt.
- On the saved page Baton reads all 12 messages with the right roles, unique ids, no heading text, and the “Ask ChatGPT” composer. Three tests in `tests/chatgpt-capture.test.ts`.
- Wording fix: the ChatGPT card's note now says the Codex/Work figures are *below* it.

Live, on 0.3.27: the new Usage layout appeared as intended (current AI card on top, “Other AIs — Claude 68% left · Gemini 99% left” closed, counts line “6 batons · 1 folder · 8 chats”).

Verified: 221 tests in 31 files, typecheck, complete build; build-1 synced with the completeness guard. Not checked live: ChatGPT counting after this fix.

## 0.3.27 — current AI first, others in a drop-down; line under every composer

- **Usage section:** the current AI's detailed card is on top, with ↻ Refresh beside the heading (now “Usage”). Every other enabled AI is inside a closed drop-down, **“Other AIs”**, whose label shows a two-item preview such as “Claude 46% left · Gemini 86% left”. Inside, services used this week come first and the rest are behind “＋ N more services”. With no AI tab active, it reads “All AIs” and starts open. Once opened or closed by hand, it stays that way while the popup is open.
- **ChatGPT card:** when only Codex/Work and credit figures are available, the card says “Chat: ChatGPT shows no chat limit. The figures above are for Codex and Work.”
- **Line under the composer on every service:** when there is no room below the composer (DeepSeek's disclaimer sits right under it), the line goes just above the composer instead. It is never placed over a control or inside the editor, and it hides when neither spot works. New `statusLineAbove` helper with tests. From live screenshots, the line already appeared below the composer on Claude, ChatGPT, Gemini, Grok and Perplexity.
- UI test updated for the new order: current card, then the “Other AIs” drop-down containing the lanes, then Batons.

Verified: 218 tests in 30 files, typecheck, complete build; visual check with sample data and ChatGPT active (drop-down closed and open); build-1 synced with the completeness guard. Not checked live: the DeepSeek fallback position.

## 0.3.26 — lanes for the services you use

Live, on 0.3.25: the new layout showed ChatGPT as the active lane with only “—”, and Grok as “No usage shown yet”, although both had been used that day.

- **Clearer lane values.** ChatGPT shows Codex/Work limits and credits but no chat limit, so its lane now says **“No limit shown”** (“Chat: no limit shown · Work weekly 100% left · …”) instead of a bare dash. A service used this week but not in its current counting window shows **“0 sent”** (“0 msgs in last 2 h · counted by Baton”) instead of “No usage shown yet”.
- **Only services in use.** Your lanes show the active service plus any service with a usage reading or a sent message in the last 7 days. The rest sit behind **“＋ N more services”**, which toggles to “Show only services I use”. If nothing has been used yet, every enabled service is shown.
- Three tests added to `tests/usage-lanes.test.ts`.

Verified: 216 tests in 30 files, typecheck, complete build, visual check with sample data (Perplexity folded behind “＋ 1 more service”); build-1 synced with the completeness guard.

## 0.3.25 — Baton's own layout (same colours)

The user asked to keep the colours and change the structure, so Baton no longer reads as Capsule Infinity's dashboard (stat tiles with icons, a row of three equal Quick Action buttons, then a list).

- **Header:** a striped baton mark instead of the “↗” arrow; subtitle “Pass your AI work forward”.
- **Pass card** for the current chat: source line, “Pass the baton” heading, a one-line hint (you always press Send yourself), one wide primary button **“Capture this chat →”**, and smaller “＋ New Baton” and “▱ Folder” buttons. Capture settings are folded in below.
- **Your lanes:** one track per enabled service, the active one first and marked “here”. Each lane shows the best available source (new `src/core/usage-lanes.ts`):
  - the tightest official chat window, e.g. “46% left · Session · resets in 2h 4m”, or “≈” when estimated;
  - otherwise a stated or learned limit (“≈18 left”), or the count (“2 sent · counted by Baton”);
  - otherwise “—”.
  ChatGPT's Work limits and credits appear as extras, never as the chat lane. Unmeasured lanes use a dashed track; lanes under 20% turn the warning colour. ↻ Refresh sits beside the heading, and the detailed card for the current chat follows.
- **Batons:** the stat tiles became one quiet line, “4 batons · 1 folder · 3 chats”, with correct singular and plural. Each Baton row has a left edge in its service's brand colour.
- **Unchanged:** the colour palette (dark and light), every element ID, and all behaviour. The sidebar uses the same markup.
- Four tests in `tests/usage-lanes.test.ts`. The UI test now also checks the new structure: no stat tiles, Capture as the single primary action, lanes above the list.

Visual check: the built popup was loaded in a browser with sample data matching the user's live readings, at popup size; the header, pass card, lanes and coloured list rendered as intended. Light mode and the narrow sidebar were not checked visually.

Verified: 213 tests in 30 files, typecheck, complete build; build-1 synced with the completeness guard.

## 0.3.24 — Pass 0.3.24 — renamed from Handoff

Why: two Chrome Web Store extensions are already called “Handoff” and do the same job, and “Capsule” is Capsule Infinity's own word. A Firefox add-on is called plain “Baton”, so the official name is **Baton Pass** and the extension shows the short name **Baton**. Searches on 22 Oct 2026 found no other tool called “Baton Pass”; check the Chrome Web Store directly before publishing.

- **Manifest:** name “Baton Pass”, short name and toolbar title “Baton”, and a new description.
- **Everything on screen:** Handoff → Baton, Capsule(s) → Baton(s): New Baton, Recent Batons, All Batons, Save Baton, the stats row, sidebar, settings, the line under the composer, the rescue card, toolbar tooltips, notifications and status messages. The main button now reads **“Pass the baton ↗”**.
- **README, PRIVACY and STORE_LISTING** use the new name and say it was formerly Handoff. Historical changelogs, validation and research notes keep the old name as a record.
- **Unchanged:** extension ID, storage keys, element IDs, the `<HANDOFF_…>` boundary inside drafts (older drafts still need it), saved data, Google/Supabase backup, and the GitHub repository name. The lower-case word “handoff” is kept where it is used as an ordinary word (“compact handoff”).
- One test checks that the popup, sidebar and settings show no leftover “Capsule” or “Handoff” text.

Verified: 209 tests in 29 files, typecheck, complete build (manifest shows Baton Pass / Baton / 0.3.24); build-1 synced with the completeness guard.

## 0.3.23 — Perplexity fixed against its real page

Checked against a perplexity.ai search thread saved in Brave on 22 Oct 2026.

- **Perplexity messages were never found.** Its messages carry no `data-testid`, so the old pattern matched nothing: no capture and no send counting (seen live: “say hi” and “again” were neither counted nor captured). Questions are now read from `[data-message-bubble="right"]` and answers from `.prose[data-renderer="lm"]`, which leaves out the “Researched” step header. The right-hand bubble counts as the user's message. The composer is the content-editable box.
- **Selector bundle version 5**, so chats saved with the old patterns are rebuilt.
- On the saved page Handoff reads all four messages with the right roles. One test in `tests/perplexity-capture.test.ts` uses a trimmed copy of the real markup.

Live, on 0.3.22: Claude's “≈ … est.” estimate appeared with its explanatory note, and the duplicate-chat merge cleaned Recent (Capsules 10 → 6, Chats 12 → 8). Recorded in LIVE_VALIDATION_2026-10-21.md.

Verified: 208 tests in 29 files, typecheck, complete build; build-1 synced with the completeness guard. Not checked live: Perplexity after this fix.

## 0.3.22 — one chat, one entry

- **Duplicate chats from Grok.** Grok adds a new `?rid=…` to its address after every reply. Handoff keyed chats by the full address, so one Grok conversation was saved again after each reply, filling Recent with copies (seen live: two “ok · grok.com” entries, Chats 10 → 12). Chats are now identified by site and path only.
- **Existing duplicates merge on their own.** Recent shows one entry per chat, the newest copy. Deleting it removes every saved copy, so older ones do not reappear. Copies stay in storage, and so in backups, until deleted.
- Two tests in `tests/recent.test.ts`.

Live, on installed 0.3.21: the extension loaded without errors after the build-1 restore, and Grok showed “2 msgs in last 2 h (counted by Handoff)” under the composer and on the card. Perplexity showed the composer line (“Usage left: unknown”) on its start page; counting and capture there are still untested.

Verified: 207 tests in 28 files, typecheck, complete build; build-1 synced with the completeness guard.

## 0.3.21 — stated limits and "N left" notices (safe methods only)

The opt-in unofficial Grok reading was started, then dropped at the user's request: the Claude Code safety check blocked it, and the user chose the safe way. Its two files were deleted unused. Handoff reads only what services show on their own pages.

- **Limits the service states.** When a limit message states the allowance (“You’ve reached your limit of 20 messages per 2 hours”, “limit of 5 Pro searches per day”, “every 90 minutes”), Handoff keeps it and counts against it: “4 of 20 msgs in last 2 h · ≈16 left (limit stated by Grok)”, using the stated window. This wins over a learned limit and works on any service.
- **“N left” notices.** Plain-text notices such as “3 Pro searches left”, “You have 2 responses left” or “1 message remaining” become exact readings, shown under the composer, in the sidebar card and in the Usage window. “0 … left” counts as a reached limit. They are ignored inside chat messages, as before.
- **Rescue card ranking.** A service with no official balance but a counted one (stated or learned) is ranked by it: “≈16 of 20 left (counted)” counts as room. “≈0 left” stays unknown rather than being called limited, because it is a count, not the service's word.
- 13 tests in `tests/stated-limits.test.ts`.

**Incident during this release:** the first 0.3.21 build was cut off and produced only `background.js`. The build-1 sync uses `rsync --delete`, so it removed every other file from the installed folder, including `manifest.json`, leaving the loaded extension broken. The extension's stored data, kept by the browser, was not affected. A complete rebuild was synced within minutes. Syncing now requires `manifest.json`, the content script and the expected version to be present in the build first.

Verified: 205 tests in 28 files, typecheck, complete WXT build (manifest, pages, content script, chunks); build-1 restored and identical to the build. Wordings are representative, because no real Grok, DeepSeek or Perplexity limit message has been captured yet.

## 0.3.20 — send detection that does not depend on key presses

Live, on 0.3.19: the line under Grok's composer appeared (the visible-editor fix worked), but sending “ok” was still not counted.

- **New send signal:** the composer going from text to empty, which is what sending does. Enter, or a Send/submit button with text, still counts too. Some editors may swallow key events before the extension sees them, so key presses are no longer required.
- **Confirmation:** a signal must be followed within 90 s by a message of yours not seen on the page before. Handoff keeps a running set of messages already seen, seeded when the page loads, so it no longer matters whether the page shows your message before or after clearing the composer. Clearing the box by hand, opening, scrolling or switching chats never counts, because no new message of yours appears.
- **Grok message identity:** Grok's unique `turn-heading-<id>` is used, so sending the same text twice (“ok”, “ok”) counts twice. Before, Grok messages were identified by their text.
- One test for Grok identity.

Verified: 192 tests in 27 files, typecheck, WXT build; build-1 synced. Not checked live.

## 0.3.19 — background tabs again; Grok's real composer

- **Back to background tabs.** 0.3.18 loaded usage pages in a minimised window; on macOS that pulled the user into a new window. Refresh usage, refresh-on-open and refresh-after-send now open the usage page as a background tab in the current window and close it once read, so focus stays where it is.
- **Grok's composer.** grok.com keeps a hidden, empty textarea next to its real editor, and Handoff picked the first match: the hidden one. Effects: sends were never counted (the composer looked empty), the line under Grok's composer did not appear, and a draft would have gone into the hidden box. A shared `findEditor` now picks the editor the key press or focus is in, otherwise a visible one. It is used for send detection, the status line, the rescue card position, capture and draft insertion on every service.
- Two tests reproduce Grok's hidden textarea next to its editor.

Live, on 0.3.18: Grok capture kept working; the Grok count stayed empty (root cause above); the minimised window disrupted the user.

Verified: 191 tests in 27 files, typecheck, WXT build; build-1 synced. Not checked live after this fix.

## 0.3.18 — near-live usage after each message

- **Send detection now watches directly.** Before, a send was confirmed only when the page stopped changing, within 20 s. Grok keeps the page changing while it answers, so its sends were dropped (seen live on 0.3.17: Grok capture worked but its count stayed empty). Now Enter, or a Send/submit button, with text in the composer starts a watch for a new message of yours for up to 90 s; it is counted at the moment it was sent. Opening, scrolling or switching chats still never counts.
- **Refresh after each message** (Usage window, **on by default**): about 30 s after you send on Claude, Gemini or ChatGPT, Handoff reads that service's usage page. At most once every 5 minutes per service, and skipped when a reading is under 2 minutes old. Uses an alarm, so it survives the background worker sleeping. Between refreshes, the live estimate fills the gap.
- **Minimised window instead of tabs:** usage pages for Refresh all, refresh-on-open and refresh-after-send load in a minimised window that closes when done, so nothing appears in the tab bar. Usage tabs already open are reused.
- **Privacy:** PRIVACY.md describes when usage pages are loaded and that only send *times* (not text) are stored. The refreshes are disclosed and can be switched off, not hidden.
- One test for the 5-minute / 2-minute throttle.

Live, on 0.3.17: Grok capture worked; the chat title “do grok shows usage” was captured.

Verified: 189 tests in 27 files, typecheck, WXT build; build-1 synced. Not checked live: Grok counting with the new detection, refresh after send, and how Brave on macOS shows a minimised window being created.

## 0.3.17 — Grok fixed against its real page

Checked against a grok.com chat saved in Brave on 22 Oct 2026.

- **Grok messages were never found.** Handoff skips anything inside an element whose class mentions “sidebar”, so chat titles are not read as messages. Grok wraps its whole app in `group/sidebar-wrapper`, so every message was skipped, and sends were never counted. Layout classes containing “sidebar” (wrapper, inset, provider, layout, container, trigger, rail) no longer count as a sidebar; real sidebars are still skipped. Elements whose id mentions “sidebar”, and nav/aside, are skipped as before.
- **Hidden speaker labels removed.** Grok starts each message with a hidden “You”/“Grok” heading marked `data-no-copy`, which turned “hey” into “Youhey”. Anything a page marks `data-no-copy` is now left out of message text.
- On the saved page Handoff now reads all eight messages with the right roles.
- **DeepSeek:** live, 0.3.16 counted “2 msgs in last 24 h · counted by Handoff”. The saved `platform.deepseek.com/usage` page is the API billing page ($0.00, 0 requests), not the free chat, so it is not read.
- Two tests in `tests/grok-capture.test.ts` use a trimmed copy of the real markup.

Verified: 188 tests in 27 files, typecheck, WXT build; build-1 synced. Not checked live: Grok send counting after this fix.

## 0.3.16 — every service tracked; learned limits

Research, 22 Oct 2026:
- Similar open-source trackers ([ai-usage-tracker](https://github.com/MuneebQureshi-9/ai-usage-tracker), [deepseek-chat-tracker](https://github.com/rbyers87/deepseek-chat-tracker)) count prompts in a rolling window against a limit the user types in, and mark ChatGPT, Grok and Perplexity as only partly supported.
- DeepSeek publishes no free chat cap. xAI does not publish Grok's free limit (testers report roughly 10–50 messages per 2 hours). Perplexity's free plan reportedly gets about 3 Pro searches a day.

Changes:
- **Message counts for every service**, in the service's rolling window: 2 h for Grok, 24 h for DeepSeek and Perplexity, 5 h for Claude, Gemini and ChatGPT. Only messages you actually send are counted (same send detection as the live estimate).
- **Learned limits instead of typed guesses.** When a service shows its limit, Handoff notes how many messages were sent in that window, at most once an hour. It then shows, for example, “12 msgs in last 2 h · limit hit after ~20 last time · ≈8 left (learned)”, using the median of the last three limits. Before any limit has been seen, only the count is shown.
- Shown under the composer instead of “Usage left: unknown”, in the sidebar usage card, and in the Usage window, all labelled “counted by Handoff”.
- **DeepSeek, Grok and Perplexity are on by default**: destination list, rescue card, suggestions and Settings. They can still be switched off in Settings. Capture and draft insertion on these three have not been tested live yet.
- Four tests in `tests/message-counts.test.ts`; rescue tests updated for the new defaults.

Live, on installed 0.3.15: Handoff matched Claude's own Usage page exactly (recorded in LIVE_VALIDATION_2026-10-21.md).

Verified: 186 tests in 26 files, typecheck, WXT build; build-1 synced.

## 0.3.15

- The dashboard ↻ Refresh usage status is now one short line, e.g. “Updated 01:19 · ChatGPT ✓  Claude ✓  Gemini ✓”. A ✗ has a tooltip explaining it (signed out or page changed). The Usage window keeps the detailed status.
- “Checked 7 of 16 open AI tabs” is now “Refreshed 7 open AI tabs”. Tabs Brave has put to sleep, or opened before an extension reload, do not answer, and that is harmless.
- Live results for 0.3.10 to 0.3.14 are recorded in LIVE_VALIDATION_2026-10-21.md.

Verified: 182 tests, typecheck, WXT build; build-1 synced.

## 0.3.14 — live estimates, Refresh usage button, auto-refresh on open

Services show usage only on their own usage pages, and those pages load their numbers once, so a fully live official reading would need automated reloading. Instead, this release makes it feel live, using safe methods only:

- **Live estimate between readings.** Every official reading is saved as a calibration point, and Handoff counts the messages you **send** after it. A send counts only after Enter in the composer or a Send button, followed by a new user message within 20 s; opening, scrolling or switching chats never counts. Two readings with sends between them give a per-message cost (median of the last five), and the reading moves forward live:
  - with a learned cost: “Session ≈47% used · est. · 3 msgs since 41% at 01:08 · resets in 2h 10m”;
  - without one: “Session 41% used at 01:08 · 2 msgs since …”, with no invented number.
  Estimates are capped at 100%, stop at the window's reset time and after six hours, and never apply to ChatGPT's Work/Codex limits, credits or feature caps. Badges, alerts and the rescue card still react only to official readings. The sidebar updates as soon as a message is sent.
- **↻ Refresh usage** on the dashboard, below Capture settings, runs Refresh all and shows the result beside it.
- **Refresh when Handoff opens** is now **on by default**, at most every **10 minutes**. It can be switched off in the Usage window.
- Live, on installed 0.3.13: the Claude sidebar card and composer line showed Session 41% used and Weekly 6% used (resets in 2d 23h).
- Seven tests in `tests/usage-estimate.test.ts`.

Verified: 182 tests in 25 files, typecheck, WXT build; build-1 synced. Not checked live: send counting on each service, and the dashboard button.

## 0.3.13 — Claude usage page checked against the real page

Checked against `claude.ai/new#settings/usage`, saved in Brave on 22 Oct 2026 (Pro plan). Handoff now reads:
- **Session**: 41% used, resets in 3 hr 16 min.
- **Weekly** (All models): 6% used, resets Sun 12:30 AM.
- **Full reset (expires Oct 22)**: 1 left, from Claude's “Limit resets” section.

Fixes:
- Countdowns written as “3 hr 16 min”, “2 hrs” or “45 mins” were not understood, so Claude's session reset was dropped.
- Claude's banked full-reset offer is now shown.

Claude's bars use `role="meter"`; the existing row reader handles them. Three tests in `tests/claude-usage.test.ts` use a trimmed copy of the real markup.

Verified: 175 tests in 24 files, typecheck, WXT build; build-1 synced. Still open: the user's live sidebar showed no Claude reading after Refresh all on 0.3.11. The reader works on the saved page, so the cause is likely timing or reach in the background tab; waiting on the Refresh all status line.

## 0.3.12 — library hardening

- Saved projects were read as one all-or-nothing list. If a single stored project could not be read (damaged, or written by a newer version), the whole library appeared empty, and the next save or delete would have written that empty view back, erasing every other project. Backups of such a library also failed completely.
- Each project is now checked on its own. Readable ones are shown; unreadable ones are hidden but kept unchanged through save, delete, expiry and restore. A backup includes every readable project instead of failing.
- No data loss was observed. The smaller library seen on 22 Oct was the user's own deletions; this fixes the weakness found while checking.
- One regression test in `tests/projects.test.ts`.

Live, 22 Oct 2026, installed 0.3.11: ChatGPT's usage page showed Work 5-hour and Work weekly 100% left with resets, Credits 2,500 left and Limit resets 0 left, with no “Chat” row.

Verified: 172 tests in 23 files, typecheck, WXT build; build-1 synced.

## 0.3.11 — catch more limit messages; optional auto-refresh

Safe methods only: Handoff reads what each service displays. No private APIs, no session tokens.

- **Plain-text limit messages:** many services print the limit beside the composer without an alert role. Handoff now also reads short (≤240 characters), visible text with strict wording such as “You’ve hit the Free plan limit…”, “You’ve reached your limit of 20 messages…”, “You are out of free messages…” or “message limit exceeded”. It ignores chat messages, sidebars, the message box, other extensions and long paragraphs that only mention limits.
- **ChatGPT feature caps are named:** Images, File uploads, Deep research, Voice and Model limits. ChatGPT chat keeps working after these, so they never trigger the rescue card.
- **More reset wordings:** “try again after 4:12 PM”, “available again at 9:30 AM”, “until 6:00 PM”, “try again tomorrow at 1:30 PM”.
- **Optional auto-refresh** (Usage window, off by default): opening Handoff runs Refresh all when it has not run for 30 minutes. This cap also stops a signed-out service, whose reading never updates, from reopening on every popup.
- 13 tests in `tests/limit-messages.test.ts`. The message wordings in them are representative; exact live text for ChatGPT's and Grok's limit messages has not been captured yet.

Verified: 171 tests in 23 files, typecheck, WXT build; build-1 synced. Not checked live.

## 0.3.10 — ChatGPT usage page

- Reads ChatGPT's own **Usage** page (`chatgpt.com/settings/usage`; `/codex/settings/usage` also recognised), checked against a copy saved in Brave on 22 Oct 2026:
  - **Work 5-hour** and **Work weekly**: % left / % used, with the **exact reset time** from the page's tooltip (e.g. “Thursday, October 22, 2026 at 5:39:17 AM GMT+5:30”), falling back to “Resets in 5h 0m”.
  - **Credits**: e.g. “2,500 left”.
  - **Limit resets** available: e.g. “0 left”.
  - Labelled as Codex/Work, because the page says chat conversations are not included.
- **Fix:** before this, the general reader picked up that page's bar and showed it as **“Chat 100% left”**. The bars are labelled “Usage remaining”, so their value is what is *left*; a full bar could have been read as 100% used and falsely triggered the rescue card. ChatGPT's page now skips the general reader.
- **Rescue card:** Work, Codex, credits, banked resets and feature caps (images, files, voice, deep research) never decide that a service's chat is out, and are not used to rank how much room it has.
- **Refresh all** now includes ChatGPT's usage page. The Usage window has **Check ChatGPT's usage page (Codex and Work)**, and **Read usage ↗** opens it when ChatGPT is the active chat.
- **Grok:** no change. Free accounts get no usage counter, only a message at the limit, which Handoff already detects and which opens the rescue card.
- Five tests in `tests/chatgpt-usage.test.ts`.

Verified: 158 tests in 22 files, typecheck, WXT build; build-1 synced. Readings older than an hour, such as the earlier mislabelled “Chat” entry, expire on their own. Not checked live in the installed extension.

## 0.3.9 — Refresh all

- The Usage window's **Refresh open AI tabs** is now **Refresh all**. It still refreshes every open AI tab. Then, for each enabled service with its own usage page (Claude and Gemini so far), it reuses an open usage tab, or opens the page in a **background tab**, waits up to 20 s for a new reading, and closes only the tabs it opened.
- The status line names each service: “read”, or “not shown (signed out or page changed)”. Services without a usage page update only when they display a limit.
- It runs in the background worker, so it finishes if the popup closes. Only an extension page can start it. It reads what the service's own page displays, like opening the page yourself; no private APIs.
- Three tests in `tests/usage-refresh.test.ts`.

Verified: 153 tests in 21 files, typecheck, WXT build; build-1 synced. Not checked live.

## 0.3.8 — limit rescue card

When the chat service you are on shows that you reached its limit, a card appears **above the message box** (never over typing, attachments or Send), and can be dismissed until the limit changes:

- **Continue in…**: up to three other services, ranked by fresh readings: room left first (e.g. “Gemini · 63% left”), then services that show no limit (“no limit shown”; never an invented number), then services that are themselves limited, disabled with their reset time. One click saves this chat as a capsule and opens the chosen service with a compact project handoff as an **unsent draft**. Drafts over the 1,500-token insertion budget are not opened; the capsule is still saved.
- **Switch account**: copies the project and saves a capsule. Gemini opens Google's own account chooser; Claude, ChatGPT and others have no account switcher, so the card says where their own Log out menu is. Handoff never signs anyone in or out and does not touch provider cookies.
- **Remind me when it resets**: shown only when the service displayed a reset time. At that time the toolbar icon gets a ✓ (cleared when Handoff is opened) and, if desktop alerts are allowed, a notification appears.

A limit counts only when the service showed it within the last hour: a 100% usage window or a “limit reached” notice. A full image, file, voice or deep-research cap does not mark the whole service as limited. Disabled services (DeepSeek, Grok, Perplexity by default) are not offered.

**New permission:** `alarms`, used only for those reset reminders. It has no install warning and no access to sites or data. PRIVACY.md updated.

Verified: 150 tests in 20 files (12 new in `tests/rescue.test.ts`), typecheck, WXT build; build-1 synced. The card was rendered from its real code into a mock chat page and checked visually. **Not checked live**: needs a service actually at its limit.

## 0.3.7

- Reads Gemini's own **Usage limits** page (`gemini.google.com/usage`, introduced by Google in May 2026): “Current usage” becomes the **Session** (5-hour) window and “Weekly limit” the **Weekly** window, each with % used, % left and reset time. Readings are labelled as shown on the service page, with the time they were seen, and expire after an hour like Claude's.
- Only that page is read; the same words inside a chat, or in another extension's overlay, are ignored. 0% is kept as a real reading.
- Reset parsing understands dates and weekdays: “Resets on 28 Oct at 14:40”, “Resets Oct 28 at 2:40 PM”, and Claude's “Resets Sun 12:30 AM” (previously not turned into a countdown). Impossible dates are rejected; a date that already passed means next year.
- The popup's **Read usage ↗** opens or refreshes Gemini's usage page when Gemini is the active chat, and the Usage window has **Check Gemini's usage page** next to the Claude button.
- The content script reads a usage page about 1.5 s after it opens instead of waiting up to 30 s.
- Ten tests in `tests/gemini-usage.test.ts`.

Checked against a copy of the live page saved in Brave on 22 Oct 2026 (free account): the reader returned Session 0% resetting 22 Oct 04:40 and Weekly 0% resetting 28 Oct 14:40, local time. The test fixture is now a trimmed copy of that real markup (usage boxes only, no account data). Still to confirm in the installed extension: the reading appearing in the Usage window, and a non-zero percentage.

## 0.3.6

- Google backup is visible on the dashboard: a card under the library counts shows “Off · saved on this device only” with **Sign in with Google**, or the connected account with its last backup time and **Back up now**.
- The account dialog opens with Google sign-in and backup at the top, no longer inside a collapsed “Google sign-in and backup” section. The developer-only “Google login setup” stays collapsed below it.
- While connected, Sign in with Google is hidden and Back up now, Restore, Disconnect and Delete cloud backup are shown; while signed out, only Sign in is shown. The dialog no longer says “No sign-in is needed” to a connected user.
- One UI regression test.

Verified: 128 tests in 18 files, typecheck, WXT build; build-1 synced. Not checked live: card layout in the 400 px popup and the narrow sidebar, and the card after sign-in (the popup closes during Google sign-in and should show the account when reopened).

## 0.3.5

- A pasted Handoff draft no longer feeds its own wording into the new chat's preferences and tasks. Before this fix, a chat that started with a pasted draft picked up:
  - “Do not reply with only an acknowledgment.” (the draft's closing instruction) as a preference;
  - “Coverage: … history never rendered …” (a full-transcript header) as a preference;
  - “Next step: …” (a compact-draft label) as a task;
  - any assistant sentence quoted inside the draft, such as “You should never skip tests.”
- From a pasted draft, only the user's own content counts now: the items under “Preferences and constraints” and “Open tasks” of a compact draft, or the “## n. You” messages of a full transcript (nested drafts handled up to three levels). Text the user adds before or after the draft still counts, including the “Next task from the user:” line Handoff appends.
- The closing instruction is now one shared constant, so the wrapper and the filter cannot drift apart. Draft text is unchanged.
- Three regression tests in `tests/handoff-title.test.ts`.

Verified: 127 tests in 18 files, typecheck, WXT build; build-1 synced. Not checked live. A chat's rolling brief is rebuilt from its turns whenever Handoff observes or captures it, so older briefs correct themselves the next time that chat is open. Saved capsules keep their stored brief unchanged.

## 0.3.4

- Captured-chat titles no longer start with “##### You said The following is user-reviewed project context…”. Seen live on 2026-10-21 in the restored library.
  - Gemini's hidden user heading previews the prompt and cuts it with “...”. The old duplicate check needed an exact match, so the heading stayed in the captured text. It is now dropped when the message body starts with the preview.
  - When a chat's first message is a pasted Handoff draft, the goal is now taken from inside it: the `Goal:` line of a compact handoff, or the first user message of a full transcript (multi-line kept). Previously the wrapper sentence became the goal.
  - Captures saved before this fix keep their stored brief unchanged; only the displayed Recent title is cleaned. When the old saved goal is too short to contain the real goal, the title reads “Continued handoff”.
- Six regression tests in `tests/handoff-title.test.ts`.

Verified: 124 tests in 18 files, typecheck, WXT build; build-1 synced. Not yet checked live: re-capturing a Gemini chat that starts with a pasted handoff. Named capsules keep the name they were saved with (usually the browser tab title), so this fix does not rename them.

Known, not changed: a pasted Handoff wrapper's own sentences (for example “Do not reply with only an acknowledgment”) can still be picked up as preferences or tasks from the first user turn.

## 0.3.3

- Deleted captured capsules no longer leave their hidden rolling capture in backups. Before this fix, deleting a capsule only hid its URL locally (`dismissedRecentUrls`); the underlying chat text was still written to downloaded backups and uploaded by Back up now, and a restore into a clean profile brought it back as a Recent chat.
- Backups now carry the deleted-capsule URL list (optional field in the version 1 envelope, so older backup files keep validating). Restore merges it with local deletions and skips any capture on that list.
- Three regression tests: no upload/resurrection on empty-profile restore, deletion merge into an existing library, legacy version 1 files.

Verified: 118 tests in 17 files (two workers), typecheck and WXT production build. Unit-level only: the live clean-profile/second-device restore with disposable data is still pending and needs the human to sign in.

Not changed: deleting a capsule still keeps its local rolling capture hidden rather than erased, and a project restored from an older backup that predates a local project deletion can still reappear (backups record capsule-URL deletions, not project deletions).

## 0.3.2

- Fix persistent sidebar state after selecting another browser tab or navigating the active page.
- Clear the previous provider's usage while reconnecting; ignore late responses from a previously active tab.
- Preserve the current edited handoff while the active provider changes.
- Add four behavioral regression tests for tab changes, stale responses, unsupported pages, and failed connections.
- Record successful installed Google sign-in, explicit cloud backup and same-installation restore; remove stale setup claims.

Explicit scripting host access covers the same six chat origins already used by content scripts; the user approved this permission update. No private usage endpoint, automatic upload, or automatic message submission is added.

- Recognize Claude’s `new#settings/usage` overlay as well as its settings page; reuse the existing usage tab instead of opening duplicates.
- Hide the prompt status strip when a dialog covers the editor.

- Explain captures blocked by provider navigation drawers; remove Gemini fallback speaker headings and duplicate prompt text. Selector bundle version 3 refreshes rolling captures.

## 0.3.1 — visible usage limits and guided Google login

2026-10-21

- Header Usage button opens one view for all six supported services, reset information, provider-reading timestamps, optional desktop alerts and the prompt-strip toggle. Refresh open AI tabs bootstraps existing supported tabs and reads displayed usage without reloading them.
- Active-service usage moved above recent capsules. Percentage remaining is shown alongside the original used percentage/reset detail; message/feature counts and token balances retain their own units. Unknown stays unknown.
- Usage snapshots refresh once per minute while the UI is open. Provider DOM monitoring and 80%/95%/reached alert behavior remain in the content/background code.
- Google login setup now shows the Google-to-Supabase callback and the exact Supabase-to-extension callback, plus Copy extension callback, Open Supabase Google settings and Check Google setup again.
- Callback helper validates the extension redirect and never contains a Google client secret. OAuth stays PKCE and uses the background worker so closing a toolbar popup does not stop login.

107 automated tests, TypeScript checks and production build passed. Isolated Brave UI/content results are in sibling ui-previews reports. Google provider configuration and real Google/cloud acceptance remain pending unless separately confirmed. No private provider quota APIs, auto-submit or AI account switching are enabled.

See GOOGLE_LOGIN_SETUP.md for the exact fields from the user's screenshot. See VERIFICATION.md for acceptance boundaries.

## 0.3.0 — Capsule-style library and durable captures

2026-10-21

### Implemented

- Replaced the task-first home with the requested Capsule Infinity-style dashboard: account pill, sidebar button, three real counters, Capture Page / New Capsule / New Folder quick actions, six recent capsule cards and View All.
- Adapted the charcoal surfaces, violet accents, spacing and card structure from the MIT-licensed popup source. Included the original copyright/license notice in source and loadable build. Handoff retains its own identity and backend configuration.
- Capture Page includes older rendered messages by default, within the existing bounded scroll routine, and restores the reading position. Capture settings can disable scrolling.
- Every successful capture with an available archive saves a full, redacted, durable capsule snapshot. Repeating an unchanged capture reuses its content fingerprint. User edits and names on that snapshot are retained; changed conversations get a new snapshot.
- Recent items provide Copy and Delete. View All supports search. New Capsule opens a small name/context/folder form and saves immediately. New Folder works from the dashboard. Existing projects and recent chats remain accessible; no migration clears them.
- Opening a saved full capsule restores its snapshot even if the live conversation archive has changed. Full copy/download retain stored text. A visible compact-handoff action handles drafts above the insertion budget while keeping the full saved capsule.
- Provider selection, review, draft-only insertion, redaction, local backup/restore and the sidebar remain available.
- Usage stays an additional, separate display. Actual provider observations are shown; unknown values are not fabricated.

### Reference and boundaries

Reviewed current public repository and local source at `85880642c6a4f3f9296b5282c184c47e6f3705cf`:
https://github.com/ahmadiscoding/capsule-infinity-chrome-extension

Read popup markup/actions, generic content capture, storage, authentication and previous research notes. The popup's Capture Page path reads selected text or up to 3,000 body characters. Its content script has a separate scrolling/compression pipeline. Neither the README's 100% coverage claim nor the compression-fidelity claim proves lossless capture on every live page. Handoff keeps role-aware capture and complete stored text rather than adopting the body-text cutoff.

Not equivalent to their hosted product yet:

- Supabase public configuration and the owner-only backup table are now installed on the user-selected project, with transactional RLS checks passed. Google provider is disabled; client/redirect configuration and live OAuth/backup acceptance remain pending. Their project credentials and production servers are not reused.
- No hosted generative compression server or paid model service was added. Handoff's compact mode remains local extractive selection, with a full saved snapshot alongside it.
- Teams/collaboration are not implemented; the dashboard does not display a fictitious Teams count.
- Hidden media/history that a service never renders cannot be recovered by DOM capture. Scroll/storage bounds remain documented.
- Exact all-provider quota balances and private Claude usage connections remain unavailable under existing restrictions. Live provider checks are still required.

### Verification

106 tests in 16 files, TypeScript check, production build and isolated Brave UI/content checks. Browser fixtures do not establish signed-in provider or cloud compatibility. See VERIFICATION.md and sibling ui-previews reports for actual outcomes.

## 0.2.2 — simpler capture and clearer usage

2026-10-21

### What changed

- Home has one main action: Capture this chat. Removed the statistics grid; folders live in Saved. Older-message capture and manual context are under More capture options.
- Review shows the goal and capture receipt. Review context, then choose a destination and open an unsent draft. Detailed summaries, transfer mode, project saving and exports live under More options.
- Active-service usage appears beside the capture workflow. Claude has a Read usage action: read an already-open usage page or open Claude settings. Visible readings propagate to the prompt strip through local storage.
- Claude settings detection recognizes bounded plain-text feature rows, including nested labels with reset text between the label and percentage. It does not combine session and weekly values or read other extensions’ widgets.
- Popup and sidebar share synchronized markup with a regression check.

### Design reference

Used the user's Stitch connection to generate and inspect screen `7e3a281a2b894a62bbb03bb3954ad873` in project `5032924933235062153`. Reference image: sibling `stitch-designs/simple-popup-reference.png`. Applied the simpler hierarchy, charcoal/violet palette, compact usage and restrained interactions. Did not copy fictional model labels, quota values, memory counters, or cloud/privacy claims from the generated mockup. No remote UI assets or API key are shipped.

Compared Claude Monitor's [optional composer bar](https://github.com/claude-monitor/claude-monitor-browser-extension/blob/main/extension/page/bar.js) and [feature explanation](https://claude-monitor.com/), reviewed 2026-10-21. Its private usage requests and response interception are not enabled in Handoff under the existing restrictions and unresolved conditional authorization. A display pattern cannot make hidden quotas observable.

### Actual verification

- 104 tests in 15 files passed; TypeScript and production WXT build passed.
- Isolated Brave fixtures: popup, Saved, folder creation, sidebar, review gate, unsent draft, full copy, redaction, 31% session/5% weekly Claude card and Read usage navigation. No page errors or external UI requests.
- Packaged content fixture: 12 virtualized turns, scroll restoration, streaming merge, cross-tab usage update, below-composer non-interactive strip and draft insertion without submit.
- Signed-in live Claude and other providers were not tested. Claude Free may expose no usable percentage. Unknown stays unknown; exact all-provider quotas are not claimed.
- Google/Supabase cloud configuration and live authorization/storage tests remain pending. Local saved contexts and full backups continue to work without sign-in.
