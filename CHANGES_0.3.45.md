# Baton 0.3.45 — one-tap log-out for "another account"

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
