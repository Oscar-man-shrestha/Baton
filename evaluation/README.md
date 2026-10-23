# Continuation evaluation

## Live check (real AIs, scored with `npm run eval`)

This is the test the offline benchmark can't do: does a real AI actually continue well from Baton's draft? It takes about 20 minutes.

1. **The drafts.** `evaluation/live/drafts/` holds the one-click draft Baton sends for each of the six benchmark conversations (`npm run eval:drafts` rebuilds them after a handoff change). Five fit the draft limit and go as the whole chat; `marathon` (15,800 tokens) goes as the compact brief.
2. **Pick two AIs** you don't normally get these chats from, e.g. Claude and Gemini. Use a **new chat for every draft**, so nothing carries over between tests.
3. **For each draft:** copy it (`pbcopy < evaluation/live/drafts/todo-app.txt` on a Mac), paste it into the new chat, press Send, and copy the AI's whole first reply.
4. **Save the reply** as `evaluation/live/replies/ai-1/todo-app.txt` for the first AI and `…/ai-2/todo-app.txt` for the second (same file names as the drafts). Rename the folders to the AI's name if you like, and note the model and date in `about.txt`.
5. **Score:** `npm run eval`. Each reply gets PASS, REVIEW or FAIL:
   - **Expected points:** what a good continuation covers, e.g. for `flask-debug`: ProxyFix, x_proto, url_for, werkzeug. Three of four or more is needed to pass.
   - **⚑ flags:** things that mean the handoff didn't land: suggesting what the user turned down (Redux, the JR pass, argparse), deleting files in the never-delete CLI, banned words in the essay, a reply that only acknowledges, or asking for context the draft already gave. A flag shows the sentence, so you can judge it: “without Redux” is fine, “switch to Redux” is not.
   - Results are saved to `evaluation/live/results.json`. The command exits 2 while replies are missing and 1 if any fail.

What a pass means: the AI picked up the task where it stopped, kept the user's decisions and constraints, and didn't redo settled work. It is phrase matching, so read the REVIEW and FAIL replies yourself before drawing conclusions.

## Older synthetic fixtures (`npm run eval -- --legacy`)

Five scenarios have ten explicit checks each. Place the first answer from each of two independently chosen target models in `responses/target-a/` and `responses/target-b/`, using `<scenario>-g1.txt`, `g2.txt`, and `g3.txt` for three successive brief→handoff generations. Run `npm run eval -- --legacy`. A release passes only when every file is present and every score is at least 8/10; record the model, date, prompts, and failures alongside the response files. The string checks are a transparent first pass and require human review for paraphrases, invented authority, and whether the model asks to re-explain an already settled choice.

No target-model replies have been generated in this workspace. The harness therefore reports `pending`; it does not establish handoff quality. The synthetic fixture conversations do not substitute for the user's logged-in site sessions.

## Handoff fidelity (offline, runs anywhere)

`npm run eval:handoff` runs six conversations from `handoff-conversations.json` (coding, essay, debugging, trip planning, a long chat, and a chat well over the draft budget) through Baton's real pipeline and checks which must-keep facts reach the draft: the goal, constraints, decisions, rejected approaches, the latest artifact and where the chat stopped. It compares Baton's one-click draft, its compact brief, its full context, the last exchange only, and the first 3,000 characters of the page (a page-text grab, as some tools' quick actions do). The test fails if the one-click draft keeps less than 90% overall, 80% of any conversation, or any goal, constraint, decision or rejection.

What it shows: what survives into the draft. What it does not show: how well a given AI then continues; that needs the live replies above. The checks are exact phrases, so a correct paraphrase can count as missing.

Results on 2026-10-24 (1.1.0): one-click 100% (before 1.1.0: 80%), compact brief 99%, full context 100% but 15,800 tokens on the long chat, last exchange 38%, first 3,000 page characters 96% (on the long chat it loses where the chat stopped).
