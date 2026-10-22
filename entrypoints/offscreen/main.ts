// Hidden page that runs the on-device task model (MiniLM + Baton's topic layer). Started by the background on demand;
// closes itself after two idle minutes to free memory. Text never leaves this page.
import * as ort from 'onnxruntime-web/wasm';
import { classify, embed, parseVocab, type TopicHead, type Vocab } from '../../src/core/embed';
import head from '../../src/model/topic-head.json';

ort.env.wasm.wasmPaths = chrome.runtime.getURL('ort/');
ort.env.wasm.numThreads = 1;
let model: Promise<{ vocab: Vocab; session: ort.InferenceSession }> | undefined;
const load = () => model ||= (async () => ({
  vocab: parseVocab(await (await fetch(chrome.runtime.getURL('models/minilm/vocab.txt'))).text()),
  session: await ort.InferenceSession.create(chrome.runtime.getURL('models/minilm/model_quantized.onnx'), { executionProviders: ['wasm'] })
}))().catch(error => { model = undefined; throw error; });

let idle: ReturnType<typeof setTimeout> | undefined;
const keepAlive = () => { clearTimeout(idle); idle = setTimeout(() => window.close(), 120000); };
keepAlive();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'CLASSIFY_OFFSCREEN' || typeof message.text !== 'string') return;
  keepAlive();
  void load().then(async ({ vocab, session }) => {
    const result = classify(await embed(message.text, vocab, { Tensor: ort.Tensor as never, session: session as never }), head as TopicHead);
    sendResponse({ ok: true, guess: { label: result.label, confidence: result.confidence } });
  }).catch(error => sendResponse({ ok: false, error: String(error) }));
  return true;
});
