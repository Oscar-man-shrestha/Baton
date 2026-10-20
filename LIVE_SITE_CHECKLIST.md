# Manual live-site release checklist

Run on the tester's own logged-in sessions; do not capture or commit account data. Record browser/extension version, date, provider, result, and a redacted diagnostic for failures.

- [ ] For each of ChatGPT, Claude, Gemini, DeepSeek, Grok, and Perplexity: extract a short and long chat; verify role order, code blocks, artifacts, and virtualized older turns. Mark unsupported surfaces clearly.
- [ ] For each enabled destination: open a new tab, insert a draft, verify the editor contains the exact reviewed text, and verify nothing was submitted. Retry or manual copy must be clear when a selector fails.
- [ ] Check a visible near-limit and limit/reset banner on services where the tester can encounter one. Confirm tier/confidence and local-time reset display; never claim an exact allowance without a native signal.
- [ ] Test keyboard Tab/Enter/Escape, focus order, screen-reader labels, and high contrast. The present popup lacks a modal limit card and needs accessibility review.
- [ ] Inspect Chrome permissions, network activity, and local storage; confirm no message content leaves the extension except by a user-approved destination draft or export.
- [ ] Run the two-target, three-generation evaluation in `evaluation/`; each scenario must score at least 8/10 after human review.
- [ ] Publish the privacy policy at a stable URL and check it without a login. Confirm store listing claims against the final build.
