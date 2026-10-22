# Baton 0.3.34 — Baton button by the composer

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
