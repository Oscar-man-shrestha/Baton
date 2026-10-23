# Turning on feedback and Google Drive backup

Both features are built into Baton 1.0.0, and each switches on after one setup step that only you can do.

## 1. Feedback (about 2 minutes)

Feedback from the uninstall page, the in-extension Feedback page and the 5-pass check-in all go to one Supabase table in your existing project (`qeoduozlznznptwsfzbt`).

1. Open https://supabase.com/dashboard, then your project, then **SQL Editor**.
2. Paste the whole of `supabase/feedback.sql` and press **Run**.
3. That's it. New answers appear in **Table Editor → baton_feedback**, newest first.

The public key in Baton can only **add** rows, never read them. Only you can see the answers, signed in to Supabase. Until you run the SQL, every feedback screen falls back to "copy your message or email it to batonforai@gmail.com".

Each row has:
- `kind`: uninstall, bug, idea, confusing, praise or checkin;
- `reason`;
- `message`;
- `site`;
- `version`;
- `browser`;
- `created_at`.

Weekly routine:
1. Sort by `created_at`.
2. Count `reason` per `version`.
3. Fix the biggest group first.

## 2. Google Drive backup (about 10 minutes, once)

Baton saves "Baton backup.json" into the user's own Drive, using the `drive.file` scope. That means Baton can only see files it created. Google classes this scope as non-sensitive, so it needs no security review.

1. Go to https://console.cloud.google.com and create a project called **Baton**. Sign in as batonforai@gmail.com.
2. Open **APIs & Services → Library**, then **Google Drive API**, then **Enable**.
3. Open **APIs & Services → OAuth consent screen** and fill it in:
   - User type: **External**;
   - App name: **Baton**;
   - Support and developer email: batonforai@gmail.com;
   - App logo: `store/icon-128.png` (optional);
   - Privacy policy: https://github.com/Oscar-man-shrestha/handoff/blob/main/PRIVACY.md;
   - Scopes: add `.../auth/drive.file`.

   Save, then **Publish app**, so it isn't limited to test users.
4. Open **Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**;
   - Name: Baton extension;
   - Authorized redirect URIs: `https://<EXTENSION-ID>.chromiumapp.org/`

   Add one redirect URI per extension ID:
   - **Your unpacked copy:** the ID on `brave://extensions`, currently `cmmlhpgomhhmhkgpfjbgnhjkoedeeedo` on this Mac.
   - **The store copy:** the ID the Chrome Web Store shows after your first upload.
5. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`) into `src/config/google.json` as `driveClientId`. Then run `npm run build` and `npm run zip`.

After that, **Backups and data** in Baton shows **Back up to Drive**, **Restore from Drive** and **Disconnect Google Drive**.

Tip: after the first store upload, copy the store item's public key into the manifest's `key` field. That makes your unpacked copy use the same ID as the store copy, so one redirect URI covers both.
