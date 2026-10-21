# Baton Pass 0.3.24 — renamed from Handoff

Why: two Chrome Web Store extensions are already called “Handoff” and do the same job, and “Capsule” is Capsule Infinity's own word. A Firefox add-on is called plain “Baton”, so the official name is **Baton Pass** and the extension shows the short name **Baton**. Searches on 22 Oct 2026 found no other tool called “Baton Pass”; check the Chrome Web Store directly before publishing.

- **Manifest:** name “Baton Pass”, short name and toolbar title “Baton”, and a new description.
- **Everything on screen:** Handoff → Baton, Capsule(s) → Baton(s): New Baton, Recent Batons, All Batons, Save Baton, the stats row, sidebar, settings, the line under the composer, the rescue card, toolbar tooltips, notifications and status messages. The main button now reads **“Pass the baton ↗”**.
- **README, PRIVACY and STORE_LISTING** use the new name and say it was formerly Handoff. Historical changelogs, validation and research notes keep the old name as a record.
- **Unchanged:** extension ID, storage keys, element IDs, the `<HANDOFF_…>` boundary inside drafts (older drafts still need it), saved data, Google/Supabase backup, and the GitHub repository name. The lower-case word “handoff” is kept where it is used as an ordinary word (“compact handoff”).
- One test checks that the popup, sidebar and settings show no leftover “Capsule” or “Handoff” text.

Verified: 209 tests in 29 files, typecheck, complete build (manifest shows Baton Pass / Baton / 0.3.24); build-1 synced with the completeness guard.
