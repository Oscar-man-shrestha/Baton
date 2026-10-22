# Baton 0.3.41 — welcome page, uninstall feedback, store images

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
