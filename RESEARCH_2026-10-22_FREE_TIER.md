# Free-tier limits: what users hit, what exists, how Handoff can stand out

Researched 2026-10-22 with web search. Most numbers come from news coverage and secondary guides, which often disagree with each other; anything marked *unverified* was not confirmed on the provider's own page. Re-check before quoting numbers in the store listing.

## 1. What free users actually run into

| Service | Free limit today | Does the service show it? |
|---|---|---|
| **Claude** | Rolling 5-hour session window; Anthropic publishes no message count. Peak-hour (weekday 5–11 am PT) sessions drain faster since March 2026. Weekly caps are documented for paid plans; Anthropic reserves the right to add others. | **Yes.** Settings → Usage shows session and weekly percentage and reset. Handoff already reads this. |
| **Gemini** | Since 17 May 2026: compute-based limits that refresh every 5 hours until a weekly limit is reached. Free users get “Standard limits”; prompt complexity, chat length, Pro model, Deep Research and media use more. Old “5 prompts a day” figures are out of date. | **Yes**, per news coverage: a Usage limits page at `gemini.google.com/usage` (Settings → Usage limits) with usage and reset times. Google's help page confirms the 5-hour/weekly scheme but does not describe the page. **Handoff does not read it yet.** |
| **ChatGPT** | Reported from 6–10 Aug 2026: unlimited text chat for Free and Go, “subject to abuse guardrails”, on one model with one reasoning mode. Images, file uploads, voice and deep research stay capped. *Unverified on OpenAI's help centre.* | Partly. Caps appear as banners when hit; no usage page for free text. |
| **DeepSeek** | Unclear; sources conflict (daily quota vs. unlimited). “Server busy” is capacity, not a personal quota. | No. |
| **Grok** | “Rate-limited”; no public number found. | No public page found. |
| **Perplexity** | Reportedly 5 Pro searches/day free, basic search under fair use. *Unverified.* | Not as a usage page. |

Two more problems sit on top of the quotas:

- **Many “limits” are really the chat being too long.** Every chat has a fixed context window. Near the end, models forget early details or refuse the message, and a new chat starts from nothing. Users experience this as a limit, but no account switch fixes it.
- **Re-explaining is the real cost.** Coverage keeps recommending the same workaround: summarise the old chat, paste it into a new one. That is manual, lossy, and has to be repeated every time.

## 2. What already exists

Usage trackers:
- **AI Quota Watcher**: reads Gemini's official figures; ChatGPT numbers are local estimates.
- **AI Usage Tracker**: ChatGPT, Claude, Gemini and Copilot.
- **Puffer**: badges and reset timers for Claude, ChatGPT, Gemini, Grok and Cursor.
- **AI Karma Tracker**: paid; reads undocumented endpoints, and its developer says Gemini isn't supported.

“Continue after the limit” tools:
- **Rate Limit Rescue**
- **CarryOn**
- **LLM Context Bridge**
- **Pickup**: limit-moment focused, with a paid Pro tier.
- **MoveChat**: open source, with optional compression using your own API key.
- **Limit Skip**: Firefox, 266 users, 3.3★. Saves the chat and injects it after *you* log into another account. It does not switch accounts itself.

Capsule Infinity covers saving and reusing context.

**Gap:** these are separate tools. None found combines all of these:
- official usage readings for more than one service;
- an honest “unknown” wherever a service shows nothing;
- a one-click continue-elsewhere at the limit moment;
- durable saved projects;
- a backup you own.

That combination, plus never auto-sending, is where Handoff can stand out.

## 3. Multiple accounts: what is safe to build

Many people really do have several accounts: personal, work, school. Switching between them by hand, through the service's own account menu, is ordinary use. Handoff can make that switch cheap, because the context travels in one click and nobody has to re-explain the project.

What Handoff should **not** build is automatic account rotation sold as “unlimited tokens”. The reasons:

- **OpenAI** terms prohibit circumventing rate limits or restrictions (consumer, EU and business terms, as reproduced by terms trackers). Opening accounts to keep going past a limit is a plausible breach.
- **Anthropic** forbids sharing or lending accounts. Weekly limits were introduced partly to act on account sharing and resale, and Anthropic may suspend accounts without notice or refund. No primary source says that multiple accounts *to get around limits* are allowed.
- **Google** counts Gemini usage per account across devices. I found no Gemini clause on multiple accounts; its policy forbids working around measures Google has put in place.
- **The risk lands on the user.** If a provider decides the pattern is limit evasion, the user's accounts get suspended, including the account holding their history.
- **It contradicts the project's own rules.** Automating it would mean reading or swapping provider session cookies, which this project has ruled out since the brief. A Chrome Web Store reviewer is also likely to treat an “unlimited free tokens” claim as deceptive.

So the honest version of “feels unlimited” is this: when one place is out, continuing in the next place, with full context, takes one click and five seconds. The next place can be another service, or another of your own accounts that **you** pick in that service's own menu.

## 4. Recommended features, in order

1. **Read Gemini's official usage page** (`gemini.google.com/usage`), the same way Handoff reads Claude's: 5-hour and weekly readings, reset times, source and time shown. Gemini is already in Handoff's host permissions. *Needs a live page snapshot to write the parser and tests.*
2. **Limit rescue card.** When a service shows its limit banner, or a reading hits 100%, Handoff offers “Continue in…” with the other services ranked by fresh readings. Unknown stays unknown, and ChatGPT shows “text: no cap reported”. It also offers “Switch account in Claude/Gemini”, which opens that service's own account menu and carries the capsule, and “Remind me when Claude resets at 3:40 PM”. Drafts are never sent automatically.
3. **Usage at a glance for every service**, in one place:
   - the official percentage and reset where the service shows one (Claude, Gemini);
   - an explicit “no public limit shown” elsewhere;
   - the age of each reading.
   This is the honest version of “every detail”.
4. **Chat-length warning.** “This chat is long; the model may be forgetting early details. Start fresh with a capsule?” This fixes the most common hidden “limit”, which account switching cannot.
5. **Reset reminders**, using the existing optional notifications: “Claude is available again”. The user comes back to the original chat, with the capsule ready.
6. **Already done in 0.3.6:** Google backup is visible on the dashboard.

Not recommended, for the reasons in section 3: automatic account rotation, cookie or session swapping, private usage APIs, and marketing that promises “unlimited tokens”.

## Sources

- ChatGPT free limits: [Engadget](https://engadget.com/2234173/chatgpt-free-features-2026), [tbreak](https://tbreak.com/chatgpt-unlimited-free-text-chats/), [howdoiuseai](https://www.howdoiuseai.com/blog/2026-09-09-chatgpt-dropped-its-message-limit-here-s-what-free), [izzedo](https://www.izzedo.chat/blog/chatgpt-limits)
- Claude limits: [TechRadar](https://www.techradar.com/ai-platforms-assistants/claude/claude-is-limiting-usage-more-aggressively-during-peak-hours-heres-what-changed), [Anthropic: usage and length limits](https://support.anthropic.com/en/articles/11647753-understanding-usage-and-length-limits), [Anthropic: Pro plan usage](https://support.anthropic.com/en/articles/8324991-about-claude-s-pro-plan-usage), [freeacademy](https://freeacademy.ai/blog/claude-free-vs-pro-vs-max-comparison-2026)
- Gemini limits: [Google help](https://support.google.com/gemini/answer/17004136), [9to5Google](https://9to5google.com/2026/05/21/gemini-usage-limits-live-user-reactions/), [AndroidSage](https://www.androidsage.com/2026/05/19/geminis-new-usage-limits/), [techbuzz](https://www.techbuzz.ai/articles/does-gemini-have-a-limit-usage-caps-explained)
- Other services: [costbench DeepSeek](https://costbench.com/software/ai-chatbots/deepseek/free-plan), [tooldirectory](https://tooldirectory.ai/blog/perplexity-vs-chatgpt-2026-grok-deepseek)
- Terms: [OpenAI clause via ConductAtlas](https://conductatlas.com/platform/openai/openai-terms-of-use/provision/CA-P-078688/no-interference-with-or-disruption-of-services/), [OpenAI community thread](https://community.openai.com/t/if-i-need-more-tokens-per-minute-limit-is-it-safe-to-just-create-a-new-account/342531), [Anthropic consumer terms](https://www.anthropic.com/legal/archive/2b400cb2-20c8-4e0d-925f-2b3f7f80dc01), [rupt.dev account-sharing summary](https://www.rupt.dev/blog/ai-subscription-account-sharing-policies/), [Gemini Apps terms via ConductAtlas](https://conductatlas.com/platform/google-gemini/gemini-apps-terms-of-service/safety-filter-circumvention-prohibition/)
- Competitors: [AI Quota Watcher](https://chromewebstore.google.com/detail/coclaoidphfeooblpbplcdbhgblelada), [AI Usage Tracker](https://chromewebstore.google.com/detail/hmdinnfodakcepioloipgejlfdgbhlgi), [Puffer](https://chromewebstore.google.com/detail/blclccmcjdkdelidnfapffbognodhfcg), [AI Karma Tracker](https://www.indiehackers.com/product/ai-karma-tracker), [Rate Limit Rescue](https://chromewebstore.google.com/detail/aheclbiphalnodcoehlkdfmnkeflakkk), [CarryOn](https://chromewebstore.google.com/detail/denjjnkibohpfmiijfljokollligjknn), [LLM Context Bridge](https://www.chromeboard.com/extension/llm-context-bridge-bnhhfhomnkpabjchaekdjlagimphdhfl), [Pickup](https://chromewebstore.google.com/detail/glfhodhcaafncaiibkpfddinicmnncke), [MoveChat](https://addons.mozilla.org/es/firefox/addon/movechat/), [Limit Skip](https://addons.mozilla.org/firefox/addon/limit-skip/)
