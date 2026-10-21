# Live results — 2026-10-21

- [x] Installed Brave Handoff updated in place; original identity and local library retained.
- [x] Google provider enabled, both callbacks matched and extension return URL saved.
- [x] Human completed Google consent; installed extension reported connected.
- [x] Approved explicit upload succeeded; server metadata confirmed one backup.
- [x] Same-installation restore validated one conversation and zero named projects, completed and retained the saved library.
- [x] Native Brave sidebar opened; tab-switch bug found and fixed in 0.3.2 (retest recorded separately).
- [ ] Cross-device and full cloud lifecycle acceptance remain pending.

The checklists below retain earlier release gates; unchecked broader items do not override the specific passes above.

## 0.2.0 additional live gates

- [ ] Reload/reconnect Codex so the authenticated Supabase MCP tools appear.
- [ ] Inspect the existing project, apply the owner-only schema if appropriate, and test two users plus an unauthenticated request. Do not expose service-role credentials.
- [ ] Enable Google in Supabase with the correct OAuth callback and exact extension redirect. Test sign-in when the popup closes, cancellation, browser restart, and expired app session.
- [ ] Test explicit cloud backup, second-device preview/restore, disconnect and separate cloud deletion.
- [ ] On each enabled AI site, test an already-open page without reload, long virtualized history, a streaming response, repeated prompts, revised branches, tables/code, unsupported media, and draft-only insertion.
- [ ] Check real session/weekly/model/tool notices, source times, unknown states, elapsed resets and manual account changes. Do not infer quotas from a third-party extension widget.
- [ ] Test 80/95/reached alerts and toolbar snapshot badges without duplicate notices; confirm the below-composer strip never covers typing, voice, attachments or Send.
- [ ] Test real browser sidebar opening, keyboard navigation, screen reader, light/high-contrast modes and reduced motion.

# Manual live-site release checklist

Run on the tester's own logged-in sessions; do not capture or commit account data. Record browser/extension version, date, provider, result, and a redacted diagnostic for failures.

- [ ] Repeat the reported DeepSeek to-do-app example: verify the original user request, five unanswered questions, and no sidebar chat titles appear in the reviewed draft. Verify a page showing only an assistant reply blocks transfer with clear recovery guidance.
- [ ] For each of ChatGPT, Claude, Gemini, DeepSeek, Grok, and Perplexity: extract a short and long chat; verify role order, code blocks, artifacts, and virtualized older turns. Mark unsupported surfaces clearly.
- [ ] For each enabled destination: open a new tab, insert a draft, verify the editor contains the exact reviewed text, and verify nothing was submitted. Confirm a destination continues the goal rather than replying only “Ready.” Retry or manual copy must be clear when a selector fails.
- [ ] Check a visible near-limit and limit/reset banner on services where the tester can encounter one. Confirm tier/confidence and local-time reset display; never claim an exact allowance without a native signal.
- [ ] Test keyboard Tab/Enter/Escape, focus order, screen-reader labels, dark mode, high contrast, and popup scrolling on the revised popup and settings page. Static markup checks pass; live visual and assistive-technology review is pending.
- [ ] Confirm the prompt status line sits below the editor without covering typing, buttons, or suggestions on each supported service, including narrow windows and dark mode. Confirm it hides when there is no room and never takes focus. The earlier overlay bug must be retested in Brave after reload.
- [ ] On long chats, scroll through several virtualized windows, reopen Handoff, and compare the copied local transcript against the rendered messages. Confirm gaps and the 300,000-character cap are disclosed. Then opt into older-message capture. Check that the chat returns to its previous scroll position, the draft has no repeated turns, and missing history is still clearly warned about. Test each supported service separately.
- [ ] Reopen a saved project from the popup; search, copy its readable brief, and delete one project in settings without affecting another project.
- [ ] On Gemini, open the account shortcut and use Google’s own profile menu manually. Verify the extension never reads account identifiers, credentials, or cookies and never changes accounts on its own.
- [ ] Inspect Chrome permissions, network activity, and local storage; confirm no message content leaves the extension except by a user-approved destination draft or export.
- [ ] Run the two-target, three-generation evaluation in `evaluation/`; each scenario must score at least 8/10 after human review.
- [ ] Privacy policy URL: https://github.com/Oscar-man-shrestha/handoff/blob/main/PRIVACY.md (public repository pushed 2026-10-22; the page returned HTTP 200 without login). Still to do: confirm the final policy text and store listing match, and add operator contact details.
# Usage alert checks added for 0.1.2

- [ ] On each of ChatGPT, Claude, Gemini, DeepSeek, Grok, and Perplexity, inspect a signed-in page with no limit notice: popup says "No recent service limit signal" and no notification appears.
- [ ] Where a service actually displays a balance, confirm the popup shows only that service's figure; compare the displayed percentage and reset with the page. Do not infer free-tier percentage from a prompt token count.
- [ ] With desktop alerts turned on in the popup, verify Chrome requests optional notification permission once. Test a real 80%/95% or near/reached notice when available and confirm one alert per threshold/window, not repeated on page mutation or refresh.
- [ ] Confirm a quoted usage-limit message inside chat text creates no usage alert. Confirm a stale cached figure disappears from the popup after one hour.
- [ ] Check the status line is outside the composer and does not block typing, controls, or accessibility focus on all six services.

## Already-open tab and prompt-line checks for 0.1.3

- [ ] Keep a supported ChatGPT conversation tab open, update/reload Handoff in Brave, **do not reload ChatGPT**, open the Handoff popup, and capture. It should connect, capture visible messages, and keep watching new messages. Repeat on a second supported service.
- [ ] On a fresh Gemini `/app` page with no user message, click Capture. The status should say Handoff is connected and watching, not “original user message was not captured.” Send a message, then capture again without reloading.
- [ ] On a chat where an assistant message is visible but the original user message is not, transfer remains blocked with older-message/paste recovery. No old archive from a generic new-chat route may be reused.
- [ ] Verify the status line says **Usage left: unknown** below an empty prompt bar when the service provides no balance. When typing, verify the approximate prompt-token count precedes that line. Test ChatGPT at the bottom edge of the viewport and Gemini beside another usage bar; no control or other widget should be covered.

## Gemini and Claude checks for 0.1.4

- [ ] In the user's Gemini to-do-list example, capture without reloading. Confirm the prompt appears once, no “You said”/“Gemini said” chrome is copied, and the captured transcript preserves headings, bullets, numbered features, and code. Compare the compact draft with the user's requirements and the assistant's edge-case advice. Confirm no sidebar chat titles appear.
- [ ] Reopen the chat from **Pick up where you left off**. Confirm it appears without manually naming a project. Save it into a local folder, reopen it, move the folder in settings, and verify another project is unaffected.
- [ ] On a signed-in Claude paid account that shows a numeric usage screen, click **Check Claude's usage page**. Compare the popup and composer value with Claude's own session percentage. Return to a chat; the value should be marked “last shown” after five minutes and unknown after one hour. A second Claude tab without a visible number should not erase it immediately.
- [ ] On Claude Free, record whether the usage page shows a numeric percentage. If it does not, verify Handoff says unknown, including while typing. Never infer a free-tier percentage from prompt tokens.
- [ ] Repeat short and long Claude captures with current UI markup, including alternate wrapper selectors; compare role order and missing-message warning. Confirm no live-site claim is made from the synthetic fixture alone.
