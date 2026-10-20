# Continuation evaluation

Five scenarios have ten explicit checks each. Place the first answer from each of two independently chosen target models in `responses/target-a/` and `responses/target-b/`, using `<scenario>-g1.txt`, `g2.txt`, and `g3.txt` for three successive brief→handoff generations. Run `npm run eval`. A release passes only when every file is present and every score is at least 8/10; record the model, date, prompts, and failures alongside the response files. The string checks are a transparent first pass and require human review for paraphrases, invented authority, and whether the model asks to re-explain an already settled choice.

No target-model replies have been generated in this workspace. The harness therefore reports `pending`; it does not establish handoff quality. The synthetic fixture conversations do not substitute for the user's logged-in site sessions.
