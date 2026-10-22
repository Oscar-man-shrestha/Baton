# Baton 1.0.0 — ready for the Chrome Web Store

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
- **Version 1.0.0**, with an upload zip from `npm run zip`.

Verified: 246 tests in 35 files, typecheck, complete build, browser smoke test (see the commit), build-1 synced.
