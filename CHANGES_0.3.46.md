# Baton 0.3.46 — fixes from a full browser test

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
