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

## Addendum — 0.3.7 Gemini usage reading (2026-10-22)

Installed 0.3.7 in the Work profile (footer v0.3.7). With `gemini.google.com/usage` open (free account, page showing Current usage 0% and Weekly limit 0%), the Handoff popup showed **Session 100% left · resets in 4h 15m** and **Weekly 100% left · resets in 6d 14h**, labelled “Service reading · 00:25:46”, and the toolbar badge showed 0%. The resets match the page's “Resets at 04:40” and “Resets on 28 Oct at 14:40”. A non-zero percentage has not been observed yet. The extension reload signed Handoff out of Google, as designed.

## Addendum — 0.3.10 to 0.3.14 usage readings (2026-10-22)

- **0.3.11, ChatGPT** (`chatgpt.com/settings/usage`): sidebar showed Work 5-hour and Work weekly at 100% left with resets, Credits 2,500 left and Limit resets 0 left; the earlier mislabelled “Chat” row was gone.
- **0.3.13, Claude:** sidebar and composer line showed Session 41% used and Weekly 6% used (resets in 2d 23h). The reading probably predates the reload, which is why the session reset was missing; 0.3.13 fixed “hr/min” countdowns.
- **0.3.14, dashboard ↻ Refresh usage:** status said “Usage pages: ChatGPT read, Claude read, Gemini read”.
  - Claude: Session 49% used, resets in 3h 3m (the session reset now appears); Weekly 7%, 2d 23h; Full reset (expires Oct 22) 1 left.
  - Gemini: Session 6% used, resets in 3h 21m; Weekly 0%, 6d 13h. Another usage extension on the same page independently showed 6% / 0%.
- **0.3.15, side by side with Claude's own Usage page:** Current session 51% used, resets in 2 hr 56 min, and All models 7% used, resets Sun 12:30 AM, plus Full reset expiring Oct 22. Handoff showed Session 51% used (49% left), resets in 2h 56m; Weekly 7% used, resets in 2d 23h; Full reset 1 left. The toolbar badge showed 51%. Exact match.
- **0.3.16, DeepSeek:** sidebar card showed “2 msgs in last 24 h · counted by Handoff” after two sends.
- **0.3.17, Grok capture:** fixed against the real page; chats such as “do grok shows usage · grok.com” were captured live.
- **0.3.20, Grok send counting:** after sending “just say ok”, the line under Grok's composer and the Grok card both showed “1 msg in last 2 h (counted by Handoff)”. Earlier attempts failed: 0.3.17 relied on the page settling, 0.3.18 picked Grok's hidden textarea, and 0.3.19 relied on key events.
- **0.3.20, Claude counting and refresh after send:** after one message (“just say o”), the Claude card showed “1 msg in last 5 h · counted by Handoff”. A new service reading (Session 54% used, resets in 2h 25m; Weekly 8%) was stamped 01:56:13, about 30 s after the send, consistent with refresh after send. A manual ↻ followed at 01:56:29. The tab bar was not observed during the refresh.
- **0.3.21, six-service round (22 Oct, about 02:09–02:13):**
  - Gemini: Session 14% used (resets in 2h 27m), Weekly 1%, “1 msg in last 5 h”, reading 02:09:42. Another extension's overlay still showed an older 6%.
  - DeepSeek: “3 msgs in last 24 h”.
  - Grok: “2 msgs in last 2 h” under the composer and on the card.
  - Claude: Session 54%, Weekly 8%, Full reset, “1 msg in last 5 h”.
  - ChatGPT: Work 5-hour and weekly 100% left, Credits 2,500, Limit resets 0.
  - Perplexity: only the composer line on the start page; nothing sent.
  - The duplicate “ok · grok.com” entries were still visible because 0.3.22 had not been loaded.
- **0.3.22, Claude live estimate:** after another message, the card showed “Session ≈54% used · est. · 1 msg since 54% at 02:16 · resets in 2h 4m”, “≈46% left”, Weekly “≈8%”, “3 msgs in last 5 h”, and the note “Values marked ≈ are estimated from messages you sent since”. The estimate equals the last reading because the learned per-message cost from recent tiny replies is about 0%.
- **0.3.22, duplicate merge:** after the reload, Capsules went 10 → 6 and Chats 12 → 8, with no repeated Grok entries.
- **0.3.22, Perplexity:** two questions (“say hi”, “again”) were neither counted nor captured. The saved page showed no `data-testid` on messages; fixed in 0.3.23.
- **0.3.23, Perplexity:** after the question “hi”, the card showed “1 msg in last 24 h · counted by Handoff”, and the thread was captured as “say hi · perplexity.ai”.
- **0.3.23, ChatGPT:** the screenshot was taken while the reply was still streaming; no count line yet, so not confirmed.
- Not yet observed live: ChatGPT send counting, a learned or stated limit, and the rescue card on a real limit.

## Automated checks

115 tests in 17 files passed with two workers. TypeScript and the production build passed. One earlier run alongside a production build timed out importing the cloud test module and caused a follow-on mock failure; the complete suite passed after avoiding that resource contention. No timeout gate was relaxed.

## Still pending

- Cross-device restore into an empty library, expired session, browser restart, cancellation, disconnect, and cloud deletion. Extension reload cleared app sign-in as designed; it retained local saved content and the cloud snapshot.
- Full capture/insertion acceptance across all six providers, long branches/streaming/media/artifacts, accessibility audit, and real threshold notifications. Gemini short capture and Claude visible usage are narrow live passes.
- Exact continuous quota access for providers that do not expose an account balance. Private APIs and interception remain disabled.
- Two-target, three-generation handoff quality evaluation: destination responses have not been submitted, and no score is claimed.
- Public privacy policy, Google publication requirements, and store release. Privacy URL remains pending: repo not yet published. No remote push or hosting deployment was made.
