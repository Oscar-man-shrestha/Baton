# Positioning — Handoff

**Audience.** Students and solo builders who use several free AI chat services on one project and need to continue when a conversation grows unwieldy or a provider's usage allowance runs out.

**Promise.** Carry the state of the work into another service as a short, inspectable draft, with enough evidence to see what was preserved and what was omitted. The user chooses the destination and presses Send.

**Category.** A local browser extension for project continuity across AI chats. Its useful unit is a versioned project brief: goal, user-approved decisions, proposed ideas, constraints, latest artifact, open tasks, and next step, each with source provenance where possible.

**Why this position.** [FreshContext](https://chromewebstore.google.com/detail/freshcontext/hggdbdifeefhpklgngdfajlloipbldki) already advertises context-window warnings and an editable handoff. [Relay](https://www.onrelay.app/docs/getting-started) already advertises project memory. [Claude Counter](https://github.com/she-llac/claude-counter) already displays native usage signals. “First meter,” “first brief,” and “first cross-chat memory” are therefore unsupported claims. The defensible wedge is **a handoff whose quality is measured and whose uncertainty is visible**.

**Product pillars.**

1. **Prove continuity.** Publish a repeatable three-generation handoff evaluation with factual, rule, provenance, artifact, and next-step checks. Show scores per release, including failures; do not promise lossless transfer.
2. **Preserve authority.** Distinguish a user's ratified decision from an AI proposal or superseded idea. Keep the last artifact and next step legible. A receipt shows token estimate, preserved sections, dropped sections, and redactions before transfer.
3. **Warn honestly.** Keep context-window fullness separate from account usage allowance. Parse visible provider notices, show the signal tier and confidence, and say “unknown” when the provider does not publish enough information. A pre-limit suggestion is an estimate, never a guarantee.
4. **Recommend with reasons.** Rank other services the user chooses to use by prompt intent, known capacity, and adapter health. Offer a same-service fresh chat and waiting for reset as ordinary choices.
5. **Stay local and reviewable.** Run without a mandatory server. Sanitize hidden text and likely secrets, let the user edit the draft, and never submit it automatically. No account switching, credential or cookie handling, or limit evasion.

**One-line description.** “Keep your AI project moving with a compact, checked handoff you control.”

**Proof required before launch.** Local fixtures must pass for every enabled adapter; the seeded secret and hidden-text tests must pass; a brief must stay below 1,500 approximate tokens while preserving required fields; the public harness must meet the stated 8/10 per-generation target; and human testers must verify draft insertion on their own logged-in sessions. Until those checks pass, market the extension as a test build rather than a reliable cross-provider handoff.

*Research checked 2026-10-20. Product descriptions are vendor claims, not independently reproduced results.*
