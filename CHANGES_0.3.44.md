# Baton 0.3.44 — same AI, another account

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
