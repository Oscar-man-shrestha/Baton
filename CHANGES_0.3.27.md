# Baton 0.3.27 — current AI first, others in a drop-down; line under every composer

- **Usage section:** the current AI's detailed card is on top, with ↻ Refresh beside the heading (now “Usage”). Every other enabled AI is inside a closed drop-down, **“Other AIs”**, whose label shows a two-item preview such as “Claude 46% left · Gemini 86% left”. Inside, services used this week come first and the rest are behind “＋ N more services”. With no AI tab active, it reads “All AIs” and starts open. Once opened or closed by hand, it stays that way while the popup is open.
- **ChatGPT card:** when only Codex/Work and credit figures are available, the card says “Chat: ChatGPT shows no chat limit. The figures above are for Codex and Work.”
- **Line under the composer on every service:** when there is no room below the composer (DeepSeek's disclaimer sits right under it), the line goes just above the composer instead. It is never placed over a control or inside the editor, and it hides when neither spot works. New `statusLineAbove` helper with tests. From live screenshots, the line already appeared below the composer on Claude, ChatGPT, Gemini, Grok and Perplexity.
- UI test updated for the new order: current card, then the “Other AIs” drop-down containing the lanes, then Batons.

Verified: 218 tests in 30 files, typecheck, complete build; visual check with sample data and ChatGPT active (drop-down closed and open); build-1 synced with the completeness guard. Not checked live: the DeepSeek fallback position.
