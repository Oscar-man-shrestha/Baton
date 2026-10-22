# Baton 0.3.37 — rankings for today's free tiers, stronger task check

- **Rankings v2 (`rankings.json`):** re-ranked for what each service gives free users in October 2026, with the evidence and links in RANKINGS.md.
  - Gemini drops for code, research and maths: since 9 Oct the free app mostly runs Flash-Lite.
  - Gemini is now first for images: it is the most generous free image maker.
  - ChatGPT is first for everyday use (no cap on free text chat) and second for research (top-rated web search).
  - DeepSeek stays first for maths and second for code.
  - Perplexity stays first for research and news (every free answer is cited).
  - Reasons were updated to match. This file is also the online copy, so installed 0.3.36 users get it within a day.
- **Stronger task check:** weighted cues instead of word counts.
  - Strong signs outweigh shared words like "write", "latest" and "compare". Strong signs are a code block, a stack trace, a file name, "generate an image of…", "% of", "new prime minister", and similar.
  - Vocabulary is much wider, including casual phrasing ("can u fix my code").
  - "Asking about a picture" is no longer "make a picture". Time words alone ("dinner tonight") no longer mean news.
  - A prompt with no clear sign gets the everyday order.
- **Measured honestly:**
  - 217 labelled prompts that the cues were tuned on: 216 right.
  - 40 fresh prompts never used for tuning (`tests/fixtures/topic-heldout.json`): 28 right (70%). All 12 misses fell back to "general", none to a wrong topic. A test keeps both properties.
- **Fix the guess in one tap:** the Baton menu shows task chips (Code, Research, Current events, Writing, Maths, Images, General). Tapping one re-ranks the list, and the pick you then make counts for that task.

Verified: 231 tests in 33 files, typecheck, complete build; build-1 synced with the completeness guard. Not checked live: the chips and the new order on each site.
