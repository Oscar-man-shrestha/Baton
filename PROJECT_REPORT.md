# Handoff — project report

**Version:** 0.1.3 local build  
**Date:** 2026-10-21  
**Status:** Working prototype with automated checks. Signed-in live-site testing and store publication remain pending.

## 1. Purpose

Handoff helps a person continue a project in a different AI chat without manually rebuilding the context. It captures rendered conversation text from the chat page the person is viewing, creates a compact editable brief, suggests another service based on the current task, and opens that brief as an unsent draft. The person reviews it and presses Send in the destination service.

The second job is usage awareness. Handoff shows a small status line below the prompt composer and a six-service overview in its popup. It reports a remaining percentage only when a service visibly provides one. It can show a service's near-limit or reached-limit notice and optionally send a desktop alert. An unknown balance stays unknown.

## 2. Supported services

The browser content script runs only on ChatGPT (`chatgpt.com`), Claude (`claude.ai`), Gemini (`gemini.google.com`), DeepSeek (`chat.deepseek.com`), Grok (`grok.com`), and Perplexity (`www.perplexity.ai`). ChatGPT, Claude, and Gemini have synthetic fixtures; the other three are best-effort adapters. A live signed-in regression pass across all six is still required because each service can change its page layout.

## 3. Primary user journey

1. The user opens an existing chat or a new chat and clicks Handoff. If that tab predates the extension install/update, Handoff connects to the current supported tab on this user action. It begins watching rendered messages without requiring a page reload.
2. On a new chat with no messages, Handoff says it is connected and watching. The user can send a message, reopen Handoff, and capture the exchange.
3. The user presses **Capture this chat**. For long chats, **Try to include older messages** temporarily scrolls the conversation, merges overlapping windows, then restores the original scroll position. Capture can remain incomplete on virtualized pages.
4. Handoff extracts visible user/assistant turns, removes hidden text, collects visible artifacts where supported, and maintains a bounded local transcript. If it cannot find the original user message, it blocks transfer and gives recovery guidance.
5. A local extractive brief summarizes goal, decisions, latest exchange, open tasks, unanswered questions, and next step. Suspected secrets and personal data are redacted. The user opens **Review or edit the draft** and can change everything before transfer. A receipt shows approximate size, omitted material, redactions, and warnings.
6. Handoff classifies the task as planning, coding, writing, research, or reasoning, then suggests a destination. The user can change it. It opens a new destination tab and inserts the reviewed text as an unsent draft. Copy is available as a fallback. It never presses Send.
7. The user may save the brief as a named local project and later resume, search, export, import, or delete it.

## 4. Usage-awareness behavior

- A quiet, noninteractive line appears **below** the prompt bar on supported pages when there is room. It always gives a usage state: a service-reported balance/near-limit/reached-limit signal, or **Usage left: unknown**. While the person types, it adds an approximate prompt-token count. Prompt tokens are not the provider's remaining allowance.
- The popup has a collapsed **Usage across AI chats** section with one row per supported service. A cached balance becomes unknown after one hour.
- If desktop alerts are enabled, Chrome requests the optional notifications permission. Handoff alerts on a displayed 80% or 95% used threshold, or a visible near/reached notice. It deduplicates alerts. Without a visible signal, it does not invent a percentage or send a numeric alert.
- It reads page-rendered notices and accessible usage labels. It does not fetch private account usage endpoints, read tokens or cookies, or switch accounts to gain quota. A Gemini shortcut only opens Google's page for a manual account choice.

## 5. Data and privacy boundaries

All transcripts, briefs, project records, settings, usage snapshots, and alert keys remain in browser-local extension storage. A transcript is capped at 300,000 characters per chat. The user can export projects, choose 7/30/90-day expiry for saved data, or delete all local Handoff data. The unsent prompt is used for the current suggestion and approximate token display; it is not saved separately. No Handoff server or telemetry is configured. The full draft is sent to another service only after the user chooses that service and eventually presses Send there.

The planned public privacy-policy URL is `https://github.com/Oscar-man-shrestha/handoff-extension/blob/main/PRIVACY.md`. **Pending: repo not yet published.** No remote was created or pushed from this project.

## 6. Architecture

- **WXT + TypeScript MV3:** `wxt.config.ts` declares narrow chat-site content scripts, local storage, tabs, activeTab, and scripting permission. Notifications are optional. Scripting is used only to connect the extension to the user's active supported tab if its receiver is missing, such as when the tab was open before installation.
- **Page adapter:** `src/core/adapter.ts` reads rendered turns, artifacts, editors, and visible limit notices through selectors in `src/selectors.json`. It excludes hidden text and obvious sidebar content; DeepSeek's active-chat selection has a reported-failure regression fixture.
- **Capture archive:** `src/core/capture.ts` merges overlapping visible windows into a bounded local transcript. `entrypoints/content.ts` monitors the page, maintains a brief, observes usage, and responds to capture or draft messages.
- **Brief and routing:** `src/core/brief.ts` builds the structured extractive handoff; `src/core/router.ts` classifies task intent and ranks enabled destinations. Routing uses visible destination limit notices where available; historical chat-size comparisons are never treated as provider capacity.
- **Usage:** `src/core/limits.ts` parses visible notices and reset text; `src/core/usage-alerts.ts` creates evidence-gated, deduplicated alerts; `src/core/composer-status.ts` formats and positions the compact line.
- **UI:** `entrypoints/popup/` owns the capture, review, usage, and continue flow. `entrypoints/options/` owns service preferences, projects, retention, and diagnostics. `entrypoints/background.ts` opens destination tabs, inserts draft text, and delivers optional browser notifications.

## 7. What has been checked

The local test suite covers selector behavior, the reported DeepSeek to-do-app handoff failure, brief building and redaction, project operations, limits and alerts, prompt-line placement, UI structure, and first-time connection fallback. TypeScript checking and the production WXT build also pass. The installable ZIP and unpacked folder are checked against the local app project copy.

This is **not** a claim that all provider pages have been exercised. Signed-in Brave tests, actual provider limit notices, notification delivery, screen-reader behavior, layout collision checks, and destination-editor insertion remain in `LIVE_SITE_CHECKLIST.md`. The five-scenario continuation evaluation has not been run against live target models. Store release requires those checks and a published privacy-policy URL.

## 8. Design priorities for the next UI pass

The popup should feel like a short guided journey, not a dashboard of settings. Give the capture action first, reveal the brief and destination only after capture, and put advanced controls behind clear disclosures. Show an empty-chat state and a precise connection-error state. Make the user's control over review and sending obvious. Keep the usage line small and outside the provider editor; label every percentage by evidence and never imply that approximate prompt tokens equal free-tier balance. `STITCH_UI_UX_BRIEF.md` contains a production-ready design brief with screens, components, exact states, and copy.

## 9. Project files

- `README.md`: setup and everyday use.
- `RESEARCH.md` and `POSITIONING.md`: competitors, papers, evidence, and product position.
- `PHASE_STATUS.md`: Phase 1–6 implementation status and open gaps.
- `LIVE_SITE_CHECKLIST.md`: manual acceptance tests.
- `PRIVACY.md` and `STORE_LISTING.md`: release drafts.
- `STITCH_UI_UX_BRIEF.md`: full UI design brief for Stitch.

## 10. Screenshot-driven update (0.1.4, 2026-10-21)

The supplied Gemini to-do-list capture exposed duplicated user text, speaker labels, and lost Markdown structure. The capture now selects Gemini's message content inside each turn; headings, lists, numbered items, and fenced code are retained. A local regression fixture reproduces the supplied structure. The compact handoff now includes useful actionable points from the assistant's long answer, so the next service can continue with the edge cases and feature list instead of only its introductory paragraph. A transcript copy remains available when the user wants full visible text rather than the compact draft.

Recent chats saved automatically by Handoff are now visible in the popup, even if the user never creates a project. Named projects can be placed in optional local folders. The popup stays focused on capture and resume; advanced controls remain folded away. Claude's visible usage page can supply a labeled session percentage; otherwise its free-tier balance remains unknown. A recent verified value is labeled as last shown, expires after one hour, and should be rechecked after manually changing accounts.

The source comparison in `RESEARCH.md` distinguishes code that was inspected from store-listing claims. Capsule Infinity uses cloud storage and server compression, while Claude Monitor gets many usage figures from authenticated internal endpoints or reply stream metadata. Those methods were not silently imported into Handoff. Google Drive backup is designed but blocked at the brief's section 10 remote-service stop condition until OAuth setup and explicit authorization. Logged-in provider behavior and continuation quality remain unverified.
