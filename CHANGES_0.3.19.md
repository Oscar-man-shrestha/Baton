# Handoff 0.3.19 — background tabs again; Grok's real composer

- **Back to background tabs.** 0.3.18 loaded usage pages in a minimised window; on macOS that pulled the user into a new window. Refresh usage, refresh-on-open and refresh-after-send now open the usage page as a background tab in the current window and close it once read, so focus stays where it is.
- **Grok's composer.** grok.com keeps a hidden, empty textarea next to its real editor, and Handoff picked the first match: the hidden one. Effects: sends were never counted (the composer looked empty), the line under Grok's composer did not appear, and a draft would have gone into the hidden box. A shared `findEditor` now picks the editor the key press or focus is in, otherwise a visible one. It is used for send detection, the status line, the rescue card position, capture and draft insertion on every service.
- Two tests reproduce Grok's hidden textarea next to its editor.

Live, on 0.3.18: Grok capture kept working; the Grok count stayed empty (root cause above); the minimised window disrupted the user.

Verified: 191 tests in 27 files, typecheck, WXT build; build-1 synced. Not checked live after this fix.
