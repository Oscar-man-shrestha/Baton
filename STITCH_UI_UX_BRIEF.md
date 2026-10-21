# Stitch design brief — Handoff browser extension

Design the **popup, settings page, and in-page usage status line** for Handoff, a browser extension that moves a project between AI chats as a user-reviewed, unsent draft. This document describes the real product and should be treated as the UI source of truth. Create polished desktop-browser UI mockups and component states. The extension is built in WXT/TypeScript, but design the interface rather than implementation code.

## Product promise

**Keep the project moving between AI chats.** Handoff captures the visible conversation on the current supported chat page, creates a short editable brief, recommends another service for the user's task, and inserts the brief into that service's composer. The user reviews it and presses Send. Supported services: ChatGPT, Claude, Gemini, DeepSeek, Grok, and Perplexity.

## Audience and tone

People who use more than one AI chat for coding, study, writing, and research. Some will be first-time extension users. Use plain language. The interface should feel calm, capable, and easy to understand on first open. Avoid technical terms such as DOM, selector, tokenization, API, tier, or confidence on the main screen. Explain approximate figures in secondary text. No gamification, fear-inducing red dashboards, or animated elements near a text editor.

## Core hierarchy

The popup is about **one next action at a time**. On first open, the main action is **Capture this chat**. After capture, the main action is **Review the draft**. After review, the main action is **Open draft in new chat**. Usage is a compact supporting section; saved projects and settings are secondary. Do not show a huge empty textarea or all three steps at once on first open.

## Popup layout and states

Target about **400 px wide**, with a comfortable scrolling height and responsive behavior around 360–440 px. Ensure important buttons are not below an unreasonably long wall of content. Create these distinct states:

1. **Supported chat, ready:** Handoff mark and one-line promise; compact status “Ready on ChatGPT” (service name changes); prominent **Capture this chat** button; quiet checkbox **Include older messages** with “Temporarily scrolls the chat, then returns to your place.” A small **Paste a brief instead** link.
2. **Tab opened before installing/updating Handoff:** the same ready state appears after the user opens the popup. Handoff connects to the already open tab automatically on that user action. Do not tell the user to reload the AI page.
3. **New empty chat:** status “Connected. No messages yet. Handoff is watching from here. Send a message, then capture again.” Do not call this a failed capture. Keep the capture button available and the manual-paste route obvious.
4. **Unsupported page or genuine connection failure:** show the specific problem and a recovery action. Do not expose a raw browser exception as the primary message.
5. **Capturing:** brief busy state, disable repeated clicks, and say whether older messages are being loaded. Do not imply a full historical capture is guaranteed.
6. **Captured:** show a short human-readable preview: project goal, last exchange, open questions, next step, and a clear “Review or edit full draft” disclosure. Show a caution when older turns or artifacts may be missing. Put token budget, dropped items, and redaction receipt inside “Capture details.” The draft must be editable before continuing.
7. **No user message found in an existing conversation:** block transfer and show recovery: include older messages or paste the original request. Preserve the assistant content for review but never turn it into a misleading handoff on its own.
8. **Destination:** show recommended service with a one-line reason and an easy select menu for alternatives. Main button **Open draft in new chat**. Secondary **Copy draft**. Text beneath: “Nothing is sent until you press Send in the next chat.” For Gemini, show a manual link to open Google's own account menu; Handoff itself does not change accounts.
9. **Saved projects:** a compact list of recent projects when any exist. Search, import/export, retention, and deletion belong on the settings page.

## Usage presentation

Add a collapsed **Usage across AI chats** section in the popup, with six service rows. Each row can show a provider-reported remaining percentage or token balance, a near-limit/reached-limit notice, a reset time if reported, or **No recent limit information**. An old reading expires after one hour. Label the source as “Shown by service.” Never draw a false full bar or zero balance for unknown usage. If a service does not display the figure, say **Usage unknown**.

Offer a clear toggle **Desktop usage alerts**. It requests Chrome's optional notification permission only when turned on. Notify once when a provider visibly reports 80% or 95% used, near limit, or limit reached. Use restrained colors: neutral for unknown, amber for near, and red only for reached. Alert settings and explanation should not dominate the main capture flow.

Design a **small, noninteractive line below the AI prompt bar**. It must never cover text, microphone/send buttons, suggestions, or another usage widget. Default text: **Usage left: unknown**. When available: **Usage left: 42% (service notice)**, **Near usage limit (service notice)**, or **Usage limit reached (service notice)**. While typing, prefix an approximate prompt count: **≈37 prompt tokens · Usage left: unknown**. Prompt tokens are not remaining quota. The line hides only when there is physically no safe room. It does not take focus or intercept clicks. Provide mockups on ChatGPT and Gemini, including the cramped bottom-edge case and a page already containing another extension's bar.

## Settings page

Use simple sections: **Services and suggestions**, **Saved projects**, **Check a chat**, and **Data retention**. Let users enable a service for suggestions and edit its task-fit labels. Projects support reopen/copy brief, search, JSON import/export, and delete. Diagnostics show counts and status only, without chat text. Retention offers Never, 7, 30, or 90 days and a clearly separated destructive **Delete all local Handoff data** action.

## Visual system

Use a compact, restrained visual identity built around the existing up-right arrow mark. Design light and dark themes with high contrast. Prefer a warm neutral surface, one clear action color, subtle borders, and generous spacing within a narrow popup. Suggested type hierarchy: product name 20 px, section title 15–16 px, body 13–14 px, supporting copy 11–12 px. Minimum interactive target height 38–40 px. Use motion only for small state transitions, with reduced-motion support. No decorative animations near the provider composer. Make status messages and warnings readable without relying on color alone.

## Accessibility and writing requirements

Use proper headings, visible keyboard focus, labels for every control, accessible status updates, and high-contrast dark mode. The user should understand the capture/review/send boundary without reading a help page. Use short text and progressive disclosure. Keep “unknown,” “approximate,” and “shown by service” visibly distinct. Do not promise account-wide free-tier percentages, automatic account switching, auto-sending, complete capture of hidden/virtualized history, or compatibility with every future provider layout.

## Deliverables from Stitch

Provide: (1) first-run popup, (2) empty-chat popup, (3) captured/review state, (4) destination state, (5) expanded usage panel, (6) settings page, (7) prompt-bar line on ChatGPT and Gemini, and (8) dark-mode and narrow-window variants. Include a compact component and token guide plus brief interaction notes for capture, review, error, alert, and draft-opening states.
# Current interface update (2026-10-21)

The popup is a short path: **Capture this chat → review the proposed handoff → choose a service → open a draft**. Named projects and automatically saved recent chats appear together under “Pick up where you left off.” The new user should be able to resume without understanding projects, tokens, or provider routing. Show the concise draft preview first; keep editing, transcript copy, suggestion feedback, and diagnostics inside disclosures. Never put a persistent badge over the composer: the small usage line sits below it only when space is available and must leave typing and controls untouched.

Usage labels must separate **approximate prompt tokens** from **account allowance**. A balance percentage appears only when visible service UI states it; otherwise show “unknown” and, for Claude, a direct “Check Claude’s usage page” action. No circular gauge or invented progress bar for an unknown balance. Saved-chat cards need title, source service, and relative date; project cards also show their chat count. The screenshot comparison in `RESEARCH.md` shows why speaker labels, sidebar text, repeated prompts, and flattened lists must stay out of the handoff preview.

For a future Google backup UI, keep the local library usable without sign-in. An explicit backup action must explain that saved chats will leave the device; connection state and last backup time need visible labels. This flow is pending authorization and OAuth configuration, so do not present a working sign-in control yet.

