# Handoff 0.3.2

- Fix persistent sidebar state after selecting another browser tab or navigating the active page.
- Clear the previous provider's usage while reconnecting; ignore late responses from a previously active tab.
- Preserve the current edited handoff while the active provider changes.
- Add four behavioral regression tests for tab changes, stale responses, unsupported pages, and failed connections.
- Record successful installed Google sign-in, explicit cloud backup and same-installation restore; remove stale setup claims.

Explicit scripting host access covers the same six chat origins already used by content scripts; the user approved this permission update. No private usage endpoint, automatic upload, or automatic message submission is added.

- Recognize Claude’s `new#settings/usage` overlay as well as its settings page; reuse the existing usage tab instead of opening duplicates.
- Hide the prompt status strip when a dialog covers the editor.

- Explain captures blocked by provider navigation drawers; remove Gemini fallback speaker headings and duplicate prompt text. Selector bundle version 3 refreshes rolling captures.
