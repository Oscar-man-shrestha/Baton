# Continuation evaluation

Five scenarios have ten explicit checks each. Place the first answer from each of two independently chosen target models in `responses/target-a/` and `responses/target-b/`, using `<scenario>-g1.txt`, `g2.txt`, and `g3.txt` for three successive brief→handoff generations. Run `npm run eval`. A release passes only when every file is present and every score is at least 8/10; record the model, date, prompts, and failures alongside the response files. The string checks are a transparent first pass and require human review for paraphrases, invented authority, and whether the model asks to re-explain an already settled choice.

No target-model replies have been generated in this workspace. The harness therefore reports `pending`; it does not establish handoff quality. The synthetic fixture conversations do not substitute for the user's logged-in site sessions.

## Handoff fidelity (offline, runs anywhere)

`npm run eval:handoff` runs six conversations from `handoff-conversations.json` (coding, essay, debugging, trip planning, a long chat, and a chat well over the draft budget) through Baton's real pipeline and checks which must-keep facts reach the draft: the goal, constraints, decisions, rejected approaches, the latest artifact and where the chat stopped. It compares Baton's one-click draft, its compact brief, its full context, the last exchange only, and the first 3,000 characters of the page (a page-text grab, as some tools' quick actions do). The test fails if the one-click draft keeps less than 90% overall, 80% of any conversation, or any goal, constraint, decision or rejection.

What it shows: what survives into the draft. What it does not show: how well a given AI then continues; that needs the live replies above. The checks are exact phrases, so a correct paraphrase can count as missing.

Results on 2026-10-23 (1.1.0): one-click 98% (before 1.1.0: 80%), compact brief 95%, full context 100% but 4,980 tokens on the long chat, last exchange 38%, first 3,000 page characters 96% (on the long chat it loses where the chat stopped).
