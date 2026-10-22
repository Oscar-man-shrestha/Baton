// Checks Baton's tokenizer and embeddings against transformers.js on the same model files.
import { readFileSync } from 'node:fs';
import * as ort from 'onnxruntime-web';
import { AutoTokenizer, pipeline, env } from '@huggingface/transformers';
import { embed, parseVocab, wordPiece } from '../src/core/embed.ts';

const dir = new URL('../public/models/minilm/', import.meta.url).pathname;
const vocab = parseVocab(readFileSync(`${dir}vocab.txt`, 'utf8'));
const session = await ort.InferenceSession.create(`${dir}model_quantized.onnx`);
// The reference loads the same model from the Hugging Face hub (development only; Baton itself never downloads it).
env.allowRemoteModels = true;
const tokenizer = await AutoTokenizer.from_pretrained('Xenova/all-MiniLM-L6-v2');
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' });
const samples = ['Hello, World!', "Why does this TypeScript function throw an error?\n```ts\nconst x = f();\n```", 'Café naïve résumé — 你好 emoji 🙂 tabs\tand  spaces', 'TypeError: Cannot read properties of undefined (reading \'map\') at App.jsx:42', "can u fix my code its not working, it's broken!!!"];
let worst = 0; let tokenMismatch = 0;
for (const text of samples) {
  const ours = wordPiece(text, vocab, 512);
  const theirs = Array.from((await tokenizer(text)).input_ids.data as BigInt64Array, Number);
  if (ours.join() !== theirs.join()) { tokenMismatch++; console.log('TOKENS DIFFER', JSON.stringify(text), ours, theirs); }
  const a = await embed(text, vocab, { Tensor: ort.Tensor as any, session: session as any });
  const b = (await extractor(text, { pooling: 'mean', normalize: true })).data as Float32Array;
  const cosine = a.reduce((sum, v, i) => sum + v * b[i], 0);
  worst = Math.max(worst, 1 - cosine);
}
console.log(`token mismatches: ${tokenMismatch}/${samples.length}; worst 1-cosine: ${worst.toExponential(2)}`);
