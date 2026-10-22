# Baton 0.3.26 — lanes for the services you use

Live, on 0.3.25: the new layout showed ChatGPT as the active lane with only “—”, and Grok as “No usage shown yet”, although both had been used that day.

- **Clearer lane values.** ChatGPT shows Codex/Work limits and credits but no chat limit, so its lane now says **“No limit shown”** (“Chat: no limit shown · Work weekly 100% left · …”) instead of a bare dash. A service used this week but not in its current counting window shows **“0 sent”** (“0 msgs in last 2 h · counted by Baton”) instead of “No usage shown yet”.
- **Only services in use.** Your lanes show the active service plus any service with a usage reading or a sent message in the last 7 days. The rest sit behind **“＋ N more services”**, which toggles to “Show only services I use”. If nothing has been used yet, every enabled service is shown.
- Three tests added to `tests/usage-lanes.test.ts`.

Verified: 216 tests in 30 files, typecheck, complete build, visual check with sample data (Perplexity folded behind “＋ 1 more service”); build-1 synced with the completeness guard.
