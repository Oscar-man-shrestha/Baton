# Handoff 0.3.8 — limit rescue card

When the chat service you are on shows that you reached its limit, a card appears **above the message box** (never over typing, attachments or Send), and can be dismissed until the limit changes:

- **Continue in…**: up to three other services, ranked by fresh readings: room left first (e.g. “Gemini · 63% left”), then services that show no limit (“no limit shown”; never an invented number), then services that are themselves limited, disabled with their reset time. One click saves this chat as a capsule and opens the chosen service with a compact project handoff as an **unsent draft**. Drafts over the 1,500-token insertion budget are not opened; the capsule is still saved.
- **Switch account**: copies the project and saves a capsule. Gemini opens Google's own account chooser; Claude, ChatGPT and others have no account switcher, so the card says where their own Log out menu is. Handoff never signs anyone in or out and does not touch provider cookies.
- **Remind me when it resets**: shown only when the service displayed a reset time. At that time the toolbar icon gets a ✓ (cleared when Handoff is opened) and, if desktop alerts are allowed, a notification appears.

A limit counts only when the service showed it within the last hour: a 100% usage window or a “limit reached” notice. A full image, file, voice or deep-research cap does not mark the whole service as limited. Disabled services (DeepSeek, Grok, Perplexity by default) are not offered.

**New permission:** `alarms`, used only for those reset reminders. It has no install warning and no access to sites or data. PRIVACY.md updated.

Verified: 150 tests in 20 files (12 new in `tests/rescue.test.ts`), typecheck, WXT build; build-1 synced. The card was rendered from its real code into a mock chat page and checked visually. **Not checked live**: needs a service actually at its limit.
