# Chrome Web Store listing draft

**Name:** Handoff — AI project brief

**Short description:** Review a compact project brief and continue in another AI chat as a draft.

**Description:** Handoff helps you carry a project's goal, decisions, latest artifact, and next step into another AI chat. Open a supported chat, capture the visible conversation, inspect the local brief and redaction receipt, choose a destination, and decide when to send. The extension does not submit messages automatically. It shows an approximate prompt token count without covering the editor when there is room, and only shows a remaining balance when the service visibly reports one. It also keeps a bounded local transcript that the user can copy, with warnings when capture may be incomplete. The current build supports ChatGPT, Claude, and Gemini fixtures; DeepSeek, Grok, and Perplexity are best-effort. Live-site compatibility must be confirmed before publication.

**Permissions justification:**

- `storage`: keeps bounded local transcripts, briefs, settings, project records, and diagnostics.
- `tabs`: opens the destination selected by the user and sends its draft to that tab.
- `activeTab`: checks the chat tab the user is working in.
- Access to the six named AI chat hosts: reads rendered conversation text, observes visible limit notices, and inserts a reviewed draft in the destination editor. No access to unrelated websites is requested.

**Privacy policy URL:** https://github.com/Oscar-man-shrestha/handoff-extension/blob/main/PRIVACY.md

**Publication status:** pending: repo not yet published. The file is in this repository root; the URL is the planned location supplied by the user. Do not submit this listing until the user publishes the repository and the URL resolves publicly to the final policy.
