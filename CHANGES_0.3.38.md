# Baton 0.3.38 — on-device AI model for the task check

- **On-device model:** the task check now has a small open-source language model behind the keywords: all-MiniLM-L6-v2 (Apache-2.0, 23 MB quantized) running in ONNX Runtime Web (MIT). It's free and permanent, and works offline, with no API, key, account or download at run time. Baton's own topic layer (7×384 weights, `src/model/topic-head.json`) is trained on 637 labelled prompts by `scripts/train-topic-head.ts`.
- **How they work together:** keywords decide when they're sure. Otherwise the model decides when it is at least 40% sure. Otherwise Baton uses the everyday order. The model is used in the Baton menu (the menu opens instantly and re-ranks once the model answers, unless you've tapped a task), the limit rescue card, and the popup's capture flow. If the model is unavailable, keywords still work as before.
- **Accuracy, measured honestly** on 50 prompts written before training and never trained or tuned on:
  - keywords 39/50 (78%);
  - model alone 46/50 (92%, 4 wrong topics);
  - **combined 46/50 (92%, 1 wrong topic)**.
  - 5-fold cross-validation on training prompts: 90%.
  - A test locks in at least 90% and at most 2 wrong topics.
- **Speed (checked in Chromium on the built files):** about 1.6 s for the first answer (model load), then about 40 ms per prompt. The hidden page closes after 2 idle minutes.
- **Correctness:** Baton's tokenizer matches transformers.js token-for-token on test strings, including punctuation, accents, Chinese characters and emoji. Embeddings agree to within 0.5% (`npm run check:embed`).
- **Manifest:**
  - new `offscreen` permission (Chrome shows no install warning for it);
  - content security policy `script-src 'self' 'wasm-unsafe-eval'` so the WebAssembly engine can run (still no remote code);
  - the extension grows from about 9 MB to about 47 MB.
- **Docs and licences:** third-party notices (MIT, Apache-2.0), PRIVACY.md and the store permission justifications are updated.

Verified: 233 tests in 33 files, typecheck, complete build, model run in Chromium from the built files; build-1 synced with the completeness guard. Not checked live: the offscreen page inside the installed extension in Brave.
