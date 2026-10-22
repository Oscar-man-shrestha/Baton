// Trains Baton's topic layer on top of the bundled MiniLM embeddings and writes src/model/topic-head.json.
// Run: node --experimental-strip-types --no-warnings scripts/train-topic-head.ts
// Training data: tests/fixtures/topic-prompts.json. tests/fixtures/topic-heldout.json is only measured, never trained on.
import { readFileSync, writeFileSync } from 'node:fs';
import * as ort from 'onnxruntime-web';
import { classify, embed, parseVocab, type TopicHead } from '../src/core/embed.ts';

const root = new URL('../', import.meta.url).pathname;
const labels = ['code', 'research', 'news', 'writing', 'math', 'image', 'general'];
const vocab = parseVocab(readFileSync(`${root}public/models/minilm/vocab.txt`, 'utf8'));
const session = await ort.InferenceSession.create(`${root}public/models/minilm/model_quantized.onnx`);
const runtime = { Tensor: ort.Tensor as any, session: session as any };
const load = async (file: string) => Promise.all((JSON.parse(readFileSync(`${root}${file}`, 'utf8')) as [string, string][]).map(async ([text, label]) => ({ text, y: labels.indexOf(label), x: await embed(text, vocab, runtime) })));
const extra = JSON.parse(readFileSync(`${root}tests/fixtures/topic-train-extra.json`, 'utf8')) as Record<string, string[]>;
writeFileSync(`${root}scripts/.extra.tmp.json`, JSON.stringify(Object.entries(extra).flatMap(([label, texts]) => texts.map(text => [text, label]))));
const train = [...await load('tests/fixtures/topic-prompts.json'), ...await load('scripts/.extra.tmp.json')];
const heldout = await load('tests/fixtures/topic-heldout-2.json');
const older = await load('tests/fixtures/topic-heldout.json');

type Row = { x: Float32Array; y: number };
function fit(rows: Row[], epochs = 400, rate = 2, decay = 1e-3): TopicHead {
  const d = rows[0].x.length; const k = labels.length;
  const weights = labels.map(() => new Array(d).fill(0)); const bias = new Array(k).fill(0);
  for (let epoch = 0; epoch < epochs; epoch++) {
    const gw = labels.map(() => new Array(d).fill(0)); const gb = new Array(k).fill(0);
    for (const { x, y } of rows) {
      const { probabilities } = classify(x, { version: 0, labels, weights, bias });
      labels.forEach((label, c) => { const error = probabilities[label] - (c === y ? 1 : 0); gb[c] += error; for (let i = 0; i < d; i++) gw[c][i] += error * x[i]; });
    }
    for (let c = 0; c < k; c++) { bias[c] -= rate * gb[c] / rows.length; for (let i = 0; i < d; i++) weights[c][i] -= rate * (gw[c][i] / rows.length + decay * weights[c][i]); }
  }
  return { version: 1, labels, weights, bias };
}
const accuracy = (head: TopicHead, rows: Row[]) => rows.filter(row => classify(row.x, head).label === labels[row.y]).length / rows.length;

// 5-fold cross-validation on the training prompts, then the untouched held-out set.
const folds = 5; let cv = 0;
for (let f = 0; f < folds; f++) { const head = fit(train.filter((_, i) => i % folds !== f)); cv += accuracy(head, train.filter((_, i) => i % folds === f)) / folds; }
const head = fit(train);
const misses = heldout.filter(row => classify(row.x, head).label !== labels[row.y]).map(row => `${labels[row.y]} ← ${classify(row.x, head).label} (${classify(row.x, head).confidence.toFixed(2)}): ${row.text}`);
// Model answers for both held-out sets, so the test suite can check the combined rule without loading the model.
const predictions = Object.fromEntries([...heldout, ...older].map(row => { const result = classify(row.x, head); return [row.text, [result.label, Math.round(result.confidence * 1000) / 1000]]; }));
writeFileSync(`${root}tests/fixtures/topic-model-predictions.json`, JSON.stringify(predictions, null, 0));
console.log(`older held-out (seen while writing training data): ${(accuracy(head, older) * 100).toFixed(1)}%`);
console.log(`cross-validation: ${(cv * 100).toFixed(1)}%  held-out: ${(accuracy(head, heldout) * 100).toFixed(1)}% (${heldout.length - misses.length}/${heldout.length})\n${misses.join('\n')}`);
const round = (value: number) => Math.round(value * 1e4) / 1e4;
import('node:fs').then(fs => fs.rmSync(`${root}scripts/.extra.tmp.json`));
writeFileSync(`${root}src/model/topic-head.json`, JSON.stringify({ version: 1, labels, weights: head.weights.map(row => row.map(round)), bias: head.bias.map(round) }));
