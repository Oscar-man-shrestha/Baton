# Updating Baton's suggestions

`rankings.json` in this repository decides which AI Baton suggests for each kind of task. Every installed copy of Baton downloads it once a day from `main`, so a change here reaches users within a day, with no new release. Users can also press **Check for updates** in Settings → Services and suggestions.

## When a model gets better at something

1. Edit `bestFor` for that task: list the services best first. Keep all six ids (`chatgpt`, `claude`, `gemini`, `deepseek`, `grok`, `perplexity`); any you leave out are added at the end.
2. Optionally update `reasons`: a short phrase per service (60 characters at most), shown in the menu, for example "searches the web with sources".
3. Optionally add `keywords` for a task (for example a new framework name under `code`). They add to Baton's built-in topic words.
4. Raise `version` by 1 and set `updated` to today's date.
5. Run `npx vitest run tests/task-fit.test.ts`, then commit and push to `main`.

Tasks: `code`, `research`, `news`, `writing`, `math`, `image`, `general`.

## Rules

- An online file with a lower `version` than the one bundled in the installed Baton is ignored. A broken file is ignored too, and Baton keeps its built-in list.
- Ids for services this version of Baton does not support are ignored. A brand-new service needs a Baton release, because it needs page readers and site permissions.
- The ranking is a judgment call. Base it on the services' own announcements and public benchmarks, and note the source in the commit message.
- A user's own order in Settings always wins over this file. Their picks nudge it by at most three places.

## Evidence for version 2 (2026-10-22)

Rankings are for what each service gives **free** users, because that is what Baton's users hit limits on. Sources are mostly secondary and often disagree. Re-check before the next version.

- **Free models:**
  - ChatGPT runs GPT-6 Luna with no cap on text chat; images, voice and deep research stay capped.
  - Claude runs Sonnet 5.5 in rolling 5-hour windows.
  - Since 9 Oct 2026 the free Gemini app picks the model itself (Auto), mostly Flash-Lite.
  - DeepSeek runs V4.1 Flash with no hard daily cap.
  - Grok's free plan is tight.
  - Perplexity Free picks its own model; every answer is cited, and Pro searches are about 3 a day.
  - Sources: [felloai free models](https://felloai.com/free-ai-models/), [tech-insider free tiers](https://tech-insider.org/au/chatgpt-vs-gemini-vs-claude-free-tiers-2026/), [felloai Perplexity](https://felloai.com/is-perplexity-ai-free/).
- **Code:** Claude models lead LMArena WebDev (Opus 5.5 #1, Sonnet 5.5 third, Oct 2026), and free users get Sonnet 5.5. DeepSeek is widely called the strongest free pick for coding and reasoning. Gemini drops because the free app now mostly runs Flash-Lite. Sources: [BenchLeader WebDev](https://www.benchleader.com/benchmarks/lmarena_webdev), [MetaText WebDev](https://metatext.io/benchmarks/lmarena-webdev).
- **Research and news:** on LMArena Search Arena (13 Oct 2026) GPT and Claude search models lead, and Gemini grounding is 15th. Perplexity is first for free users because every free answer is cited. Grok stays high for news because it reads live X posts. Sources: [Arena search leaderboard](https://arena.ai/leaderboard/chat/search), [Search Arena intro](https://news.lmarena.ai/search-arena/).
- **Maths:** DeepSeek V4.1 Flash scores GPQA Diamond 90.9 and MathArena Apex 65.6 (DeepSeek change log, 10 Sep 2026). V4 Flash scored 96.7% on AIME 2026 (independent). Sources: [DeepSeek change log](https://api-docs.deepseek.com/updates/), [Layerlens](https://layerlens.ai/blog/deepseek-v4-flash-aime2026).
- **Images:** Gemini (Nano Banana 2) is the most generous free option, at roughly 20 a day, unpublished. ChatGPT is about 2–3 a day. Grok's free images are uncertain and may be paywalled. Claude, DeepSeek and Perplexity Free don't generate images. Sources: [whizi Gemini limits](https://whizi.io/resources/gemini-image-generation-limit/), [pixmind](https://www.pixmind.io/posts/best-free-ai-image-generator-2026), [atlascloud Grok](https://www.atlascloud.ai/blog/tips/free-alternatives-to-grok-image-generation-2026).
- **Writing and general:** reviewers give Claude the nod for writing. ChatGPT is first for everyday use because free text chat has no cap. Source: [felloai best models](https://felloai.com/best-ai-models/).
