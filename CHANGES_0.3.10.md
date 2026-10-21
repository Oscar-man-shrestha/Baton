# Handoff 0.3.10 — ChatGPT usage page

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
