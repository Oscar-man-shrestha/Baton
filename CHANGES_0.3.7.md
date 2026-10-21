# Handoff 0.3.7

- Reads Gemini's own **Usage limits** page (`gemini.google.com/usage`, introduced by Google in May 2026): “Current usage” becomes the **Session** (5-hour) window and “Weekly limit” the **Weekly** window, each with % used, % left and reset time. Readings are labelled as shown on the service page, with the time they were seen, and expire after an hour like Claude's.
- Only that page is read; the same words inside a chat, or in another extension's overlay, are ignored. 0% is kept as a real reading.
- Reset parsing understands dates and weekdays: “Resets on 28 Oct at 14:40”, “Resets Oct 28 at 2:40 PM”, and Claude's “Resets Sun 12:30 AM” (previously not turned into a countdown). Impossible dates are rejected; a date that already passed means next year.
- The popup's **Read usage ↗** opens or refreshes Gemini's usage page when Gemini is the active chat, and the Usage window has **Check Gemini's usage page** next to the Claude button.
- The content script reads a usage page about 1.5 s after it opens instead of waiting up to 30 s.
- Ten tests in `tests/gemini-usage.test.ts`.

Built from a screenshot of the live page (free account, 0% used, 22 Oct 2026). The real page markup has not been inspected, so the test fixture's structure is an assumption; confirm live and, if possible, with a saved copy of the page.
