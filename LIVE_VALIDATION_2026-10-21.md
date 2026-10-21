# Installed-browser validation — 2026-10-21

## Installed build

Handoff 0.3.2, Brave on macOS. Existing extension ID `jpjfbhobndoekfmknlhdpmcndchiilog`, loaded from sibling `handoff-extension-build-1`. Update in place preserves local data and the allowlisted callback. The user explicitly approved identity/Supabase access and subsequent scripting access limited to the same six chat origins.

## Live passes

- Google provider configured, Google-to-Supabase callback matched, exact extension callback persisted in Supabase.
- User completed Google consent. Handoff reported the connected account; no credentials or app tokens were copied into source.
- User approved upload of saved contexts. Back up now succeeded; remote metadata confirmed one backup, 38,576 bytes at 2026-10-21T17:07:19.399Z. Backup content was not retrieved through the admin connector.
- Restore preview validated one conversation and zero named projects. Same-installation merge reported Cloud backup restored and retained the library. This does not prove restoration into an empty second device.
- Native Brave side panel opened. Sidebar reconnects after selecting Claude or Gemini without reloading either chat. Previously, tab changes were not observed and manual script injection lacked host access.
- Claude redirected `/settings/usage` to `/new#settings/usage`. Handoff now recognizes that overlay and the existing usage tab. Native Current session and All models each showed 0% used; Handoff showed separate Session and Weekly readings of 0% used / 100% left. These are observed account readings, not inferred free-tier balances. Weekday-format reset text in this live page did not yield a verified countdown.
- The prompt strip disappeared while Claude's settings dialog covered the editor and returned below the composer after closing it.
- Gemini's open navigation drawer hid conversation text from the accessibility tree. Closing the drawer exposed the conversation; capture then returned two messages with an explicit rendered-history warning. Hidden conversation text is not extracted. Recovery now explains the blocked layout instead of saying the chat is empty.
- Live Gemini fallback included an accessible speaker heading plus the repeated user request. The extraction fix removes that heading and deduplicates the prompt, with a regression that retains assistant code and the final question. Selector bundle version 4 rebuilds rolling archives from visible text rather than merging the old duplicate interpretation. Saved user capsules are retained.

Screenshots and private installation metadata are in sibling `ui-previews`; these are excluded from the distributable source package.

## Addendum — 0.3.3 clean-profile restore (later on 2026-10-21)

Details in `LIVE_RESTORE_TEST_2026-10-21.md`. Main profile uploaded a 6-capsule / 1-folder / 4-chat library (approved). A newly created Brave profile on the same Mac, with only Handoff 0.3.3 loaded from build-1 (same extension ID) and an empty library, signed in and restored it: counts matched and a disposable capsule's Unicode text and code value came back exactly. This is a separate-profile restore, not a different computer. Signed-out, cancelled, offline and repeated restore checks were not run.

## Automated checks

115 tests in 17 files passed with two workers. TypeScript and the production build passed. One earlier run alongside a production build timed out importing the cloud test module and caused a follow-on mock failure; the complete suite passed after avoiding that resource contention. No timeout gate was relaxed.

## Still pending

- Cross-device restore into an empty library, expired session, browser restart, cancellation, disconnect, and cloud deletion. Extension reload cleared app sign-in as designed; it retained local saved content and the cloud snapshot.
- Full capture/insertion acceptance across all six providers, long branches/streaming/media/artifacts, accessibility audit, and real threshold notifications. Gemini short capture and Claude visible usage are narrow live passes.
- Exact continuous quota access for providers that do not expose an account balance. Private APIs and interception remain disabled.
- Two-target, three-generation handoff quality evaluation: destination responses have not been submitted, and no score is claimed.
- Public privacy policy, Google publication requirements, and store release. Privacy URL remains pending: repo not yet published. No remote push or hosting deployment was made.
