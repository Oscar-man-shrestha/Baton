# Baton 1.0.0 — ready for the Chrome Web Store

- **New logo:** the old Handoff arrow is replaced by Baton's own mark, a glowing violet tile with a striped baton passed across it. It matches the pass button, the site and the store images.
  - Sizes: 16, 32, 48 and 128 px. The 16 and 32 px icons use a simpler, bolder version so they stay clear in the toolbar. The 128 px icon has the store's 16 px transparent margin.
  - The manifest's toolbar icon uses the new sizes, the extension pages and the website have favicons, and `store/icon-128.png` is the store icon.
  - Rendered from `store/src/icon*.svg` with `npm run render:icons`.
- **No more "Read your browsing history" warning:** the `tabs` permission is gone. Baton only reads the addresses of the six AI sites, which its site access already allows. The browser test checks that Baton still sees its AI tabs and can't see other addresses. STORE_LISTING.md is updated.
- **ChatGPT's usage bar is honest:** free ChatGPT text chat has no published cap, so the bar no longer shows "4 msgs in last 5 h" (a window that suggested a limit). It now says "**Chat · No cap · 4 sent today**". The usage card and the Other AIs row say "No chat cap · 4 sent today". If ChatGPT ever shows a limit message, Baton learns it and switches to "≈N left".
- ChatGPT's banked limit resets are now read as "**Banked limit resets**", so "0 left" no longer looks like a broken chat limit.
- **Version 1.0.0**, with an upload zip from `npm run zip`.

Verified: 246 tests in 35 files, typecheck, complete build, browser smoke test (see the commit), build-1 synced.
