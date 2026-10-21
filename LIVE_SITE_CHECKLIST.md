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
- [ ] Privacy policy URL: **pending: repo not yet published**. Planned URL: https://github.com/Oscar-man-shrestha/handoff-extension/blob/main/PRIVACY.md. After the user publishes the repository, open it without a login and confirm the final policy and store listing match. No remote or hosting setup is part of this local build.
