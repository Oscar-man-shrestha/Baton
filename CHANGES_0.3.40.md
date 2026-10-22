# Baton 0.3.40 — clearer words, a glowing pass button, and sign-in at the top

Feedback from a first-time user: "Folder" and the "Baton button" switch were confusing, sign-in was hidden, and the button by Send was easy to miss.

- **Clear names and help text:**
  - "New Baton" → **Write a baton** (write or paste your own context).
  - "Folder" → **New folder**. A line under the buttons says what Capture and folders do, and the folder dialog gives examples (School, Work).
  - "On chat pages" → **Show on AI chat pages**, with a line under each switch:
    - *Usage bar*: how much you have left, under the chat box;
    - *Pass button*: the glowing button by Send that moves your chat to another AI.
  - Tooltips on the page point to the new section name.
- **Glowing pass button:** 34 px (was 28 px), with a violet gradient and a soft halo. It breathes three times when it appears, then stays still. It's brighter on hover, and doesn't animate when reduced motion is on. Its placement uses the new size, so it still keeps clear of the site's own controls and the usage bar.
- **Account at the top right:**
  - Signed out: a **Sign in** button (Google).
  - Signed in: your **Google profile photo** (or your initial). Its menu shows your name and email, the last backup time, **Back up now**, **Switch account** (Google's own account chooser), **Backups and data**, and **Sign out**.
  - "Disconnect" is now called **Sign out**. Signing out or switching keeps your local batons and your cloud backup.
- Popup layout: Capture gets the full row; the other two buttons share the next row.

Verified: 234 tests in 33 files, typecheck, complete build, the popup rendered from the built files (header, buttons, switches); build-1 synced with the completeness guard. Not checked live: Google sign-in and the avatar menu with a real account, and the glow on each site.
