# Baton 0.3.36 — suggestion rankings that update online

- **One list for every suggestion:** the Baton menu, the limit rescue card and the popup's capture flow now share the same suggestions: the task's topic, then Baton's rankings, then your order and picks, then usage left. The older five-intent router (`router.ts`) and its per-service intent checkboxes have been removed.
- **Updates without a release:** `rankings.json` in the repository is bundled with Baton and also downloaded once a day from GitHub (`raw.githubusercontent.com`, a plain request with no cookies). When a model gets better at something, editing that file changes suggestions for every user within a day. The file is validated, and Baton falls back to its built-in list when the online file is broken, missing or older. It can also add topic keywords. See RANKINGS.md.
- **Your own order:** Settings → Services and suggestions → "Best AI for each kind of task". Pick a task and move AIs up or down. The buttons are "Use Baton's order", "Forget my picks" and "Check for updates". The section says whether the online list or the built-in one is in use.
- **Learns from you:** each pass from the Baton menu, and each 👍 or 👎 in the popup, nudges that AI for that kind of task, by at most three places. This is stored only in this browser.
- No new permissions: GitHub serves the file to any site, so no host access is needed.

Verified: 229 tests in 33 files, typecheck, complete build; build-1 synced with the completeness guard. Not checked live: the daily download (the file is live only after this push), the Settings editor, and the suggestions on each site.
