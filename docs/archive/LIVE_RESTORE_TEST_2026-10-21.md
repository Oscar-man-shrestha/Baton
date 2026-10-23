# Live clean-profile restore test — Handoff 0.3.3

Prepared 2026-10-21. Status: **core restore passed on 2026-10-21; signed-out, cancel, offline and repeat checks not run.** On 2026-10-21 the user approved, in chat, replacing the cloud snapshot with the current main-profile library in step A7 (this test only). Fill in the Result lines; do not paste chat text, emails or screenshots of private chats here.

Goal: prove that a Brave profile with an empty Handoff library can recover saved contexts from the Supabase cloud backup, and that cancel, offline and signed-out cases leave the library unchanged.

## Facts this test relies on

- The cloud keeps **one snapshot per Google account**. Every *Back up now* replaces it. In this script only the main profile uploads, once. The test profile only reads.
- Unpacked extension IDs come from the folder path when the manifest has no `key` (0.3.3 has none). Computed ID for build-1: `jpjfbhobndoekfmknlhdpmcndchiilog`, the ID already in the Supabase redirect allowlist. So a new profile that loads the same build-1 folder keeps the same callback.
- Restore merges into the local library and never deletes local items. Disconnect keeps the local library and the cloud backup.
- The upload in step A7 contains the main profile's whole saved library (real chat text), as in the earlier approved test. Deleted capsules are left out (0.3.3 fix).

Disposable marker used throughout: `HANDOFF-RESTORE-TEST-20261021`.

## A. Main profile (your normal Brave profile)

1. `brave://extensions` → Handoff → reload (↻). Confirm the card shows **0.3.3** and ID `jpjfbhobndoekfmknlhdpmcndchiilog`.
   Result:
2. Open Handoff and note the library counts on the dashboard (saved, folders).
   Result: saved = __, folders = __
3. Safety copy, local only: Account → **Download full backup**. Keep the JSON file private, outside any repository.
   Result:
4. **New Folder** → name `Restore test` → Create folder.
5. **New Capsule** → Name `HANDOFF-RESTORE-TEST-20261021`, Context:
   `Disposable restore check. Line 2: café ✓ — 東京. Code: const marker = 1711902849000;` → Folder `Restore test` → Save Capsule.
6. Account → **Sign in with Google**. Pick your account in Google's own chooser. Expect `Connected as … Nothing uploaded yet.`
   Result:
7. **Back up now** → expect `Saved contexts backed up to your account.` This replaces the earlier snapshot.
   Result:
8. Write down the new library counts (they should be step 2 + 1 capsule, + 1 folder).
   Result: saved = __, folders = __

## B. Clean test profile

1. Brave menu → Profiles → **Add profile** → name `Handoff Restore Test`. Skip sync and do not sign in to Brave or to any AI site.
2. In that profile: `brave://extensions` → turn on Developer mode → **Load unpacked** → choose
   `/Users/oscar/Documents/Codex/2026-10-20/referenced-chatgpt-conversation-this-is-an/outputs/handoff-extension-build-1`.
   Check the ID is `jpjfbhobndoekfmknlhdpmcndchiilog`. **If it differs, stop here** and report it. Do not add a new redirect URL.
   Result: ID =
3. Pin Handoff and open it. Expect an empty library: “No saved chats yet…”, counts 0.
   Result:
4. Signed-out check: Account → **Restore** before signing in. Expect `Sign in with Google first.` Library still empty.
   Result:
5. Account → **Sign in with Google** → choose the same account in Google's chooser. Expect `Connected as …`.
   Result:
6. Cancel check: **Restore** → the confirm dialog shows `Restore N conversations and M projects from <time>`. Write down N, M and the time, then press **Cancel**. Expect `Restore cancelled.` and a still-empty library.
   Result: N = __, M = __, time = ______, library empty after cancel:
7. Offline check: turn Wi-Fi off → **Restore** → expect an error message (any wording) and a still-empty library. Turn Wi-Fi back on.
   Result: message = ______, library unchanged:
8. Real restore: **Restore** → **OK**. Expect `Cloud backup restored.`
   Result:
9. Check recovery:
   - Library counts equal step A8.
   - Folder `Restore test` exists.
   - Open `HANDOFF-RESTORE-TEST-20261021`. The draft text matches step A5 exactly, including `café ✓ — 東京` and `1711902849000`.
   - Open one real captured conversation. It loads its saved snapshot (no blank or truncated text).
   Result:
10. Repeat check: **Restore** → OK once more. Counts do not change (no duplicates).
    Result:
11. Do **not** press Back up now or Delete cloud backup in this profile.

## C. Clean up

1. Test profile: Account → **Disconnect** (expect `Disconnected. Local data and cloud backup were kept.`). Then Brave → Profiles → delete `Handoff Restore Test`. This removes the restored copies of your chats from that profile.
2. Main profile (optional): delete the `HANDOFF-RESTORE-TEST-20261021` capsule and the `Restore test` folder. The cloud snapshot keeps them until your next Back up now; that is harmless.
3. Keep or delete the safety JSON from A3 as you prefer.

## Results, 2026-10-21 (reported by the user with screenshots; Claude did not drive the browser)

- A1–A2 (main profile “Work”): 0.3.3 loaded from build-1. Before: Capsules 5, Folders 0, Chats 4.
- A3: safety backup file downloaded.
- A4–A5: `Restore test` folder and test capsule saved.
- A6: Google sign-in → “Connected as … Nothing uploaded yet.”
- A7: Back up now → “Saved contexts backed up to your account.” (approved upload)
- A8: Capsules 6, Folders 1, Chats 4.
- B1–B3: new Brave profile, only Handoff installed, 0.3.3, ID `jpjfbhobndoekfmknlhdpmcndchiilog`, library empty (0 / 0 / 0, “No capsules yet”, Local). The user created this new profile under the name “ok” (instead of the suggested name) and loaded build-1 unpacked there; all B steps ran in “ok”. A separate “Handoff Restore Test,” profile also exists but was not used.
- B4 signed-out restore, B6 cancel and B7 offline checks: **not run**.
- B5 + B8: sign-in in the new profile, then Restore → “Cloud backup restored.”
- B9: Capsules 6, Folders 1, Chats 4 (matches A8); test capsule under `Restore test · Project`; draft text exact, including `café ✓ — 東京` and `1711902849000`. The capsule shows “full transcript unavailable”, expected for a hand-written capsule.
- B10 repeat restore: **not run**.
- Also seen (profile not confirmed): a restored captured Gemini chat opened as a saved snapshot (2 messages, saved 2026-10-21T17:59:28Z), and Open draft in new chat put the draft into Gemini's composer without sending; the prompt strip sat below the composer, clear of the ＋, mic and Send controls.
- Defects seen, not yet fixed: captured-chat titles can start with “##### You said The following is user-reviewed project context…” (Gemini speaker text and the Handoff wrapper are used as the goal); the account dialog says “No sign-in is needed” and still shows Sign in with Google while connected; a manual capsule is labelled “0 chats”.

## What this does and does not prove

Proves, if it all passes: recovery into an empty library on a separate profile with the same build, Unicode and code preserved, and no change to the library on cancel, offline or signed-out restore, or a repeated restore.

Does not prove: a different computer or OS; expired or refreshed sessions over hours; restoring a version 0.3.3 deletion list (the main profile needs a deleted *captured* capsule for that, which is optional and not in this script); the “newer local copy wins” path in a live library (unit-tested only).
