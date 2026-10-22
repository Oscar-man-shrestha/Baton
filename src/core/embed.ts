// On-device sentence embeddings with all-MiniLM-L6-v2 (Apache-2.0), bundled with Baton: no API, no key, works offline.
// The tokenizer is BERT's uncased WordPiece, written out here so the runtime is the only dependency.

const isPunctuation = (char: string) => {
  const code = char.codePointAt(0)!;
  if ((code >= 33 && code <= 47) || (code >= 58 && code <= 64) || (code >= 91 && code <= 96) || (code >= 123 && code <= 126)) return true;
  return /\p{P}/u.test(char);
};
const isChinese = (code: number) => (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf) || (code >= 0x20000 && code <= 0x2a6df) || (code >= 0x2a700 && code <= 0x2b73f) || (code >= 0x2b740 && code <= 0x2b81f) || (code >= 0x2b820 && code <= 0x2ceaf) || (code >= 0xf900 && code <= 0xfaff) || (code >= 0x2f800 && code <= 0x2fa1f);

/** BERT “basic” tokenization: clean, lowercase, strip accents, split on whitespace and punctuation, space out CJK. */
export function basicTokens(text: string): string[] {
  let cleaned = '';
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code === 0 || code === 0xfffd || (/\p{Cc}|\p{Cf}/u.test(char) && !/[\t\n\r]/.test(char))) continue;
    cleaned += isChinese(code) ? ` ${char} ` : /\s/.test(char) ? ' ' : char;
  }
  const tokens: string[] = [];
  for (const word of cleaned.trim().split(/\s+/).filter(Boolean)) {
    const plain = word.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '');
    let current = '';
    for (const char of plain) {
      if (isPunctuation(char)) { if (current) tokens.push(current); tokens.push(char); current = ''; } else current += char;
    }
    if (current) tokens.push(current);
  }
  return tokens;
}

export type Vocab = Map<string, number>;
export function parseVocab(text: string): Vocab {
  const lines = text.split('\n').map(line => line.replace(/\r$/, ''));
  if (lines[lines.length - 1] === '') lines.pop();
  return new Map(lines.map((token, index) => [token, index]));
}

/** Greedy longest-match WordPiece, with [CLS]/[SEP] and a length cap. */
export function wordPiece(text: string, vocab: Vocab, maxTokens = 128): number[] {
  const unk = vocab.get('[UNK]')!;
  const ids = [vocab.get('[CLS]')!];
  for (const token of basicTokens(text)) {
    const chars = Array.from(token);
    if (chars.length > 100) { ids.push(unk); continue; }
    const pieces: number[] = [];
    let start = 0;
    while (start < chars.length) {
      let end = chars.length; let found: number | undefined;
      while (start < end) {
        const piece = (start > 0 ? '##' : '') + chars.slice(start, end).join('');
        found = vocab.get(piece);
        if (found !== undefined) break;
        end--;
      }
      if (found === undefined) { pieces.length = 0; pieces.push(unk); break; }
      pieces.push(found); start = end;
    }
    ids.push(...pieces);
    if (ids.length >= maxTokens - 1) break;
  }
  return [...ids.slice(0, maxTokens - 1), vocab.get('[SEP]')!];
}

/** The parts of an onnxruntime session this needs, so the browser and Node can each pass their own runtime. */
export type OrtLike = {
  Tensor: new (type: 'int64', data: BigInt64Array, dims: number[]) => unknown;
  session: { run(feeds: Record<string, unknown>): Promise<Record<string, { data: unknown; dims: readonly number[] }>> };
};

/** Mean-pooled, L2-normalised 384-number meaning of a text. */
export async function embed(text: string, vocab: Vocab, ort: OrtLike): Promise<Float32Array> {
  const ids = wordPiece(text, vocab);
  const size = [1, ids.length];
  const tensor = (values: number[]) => new ort.Tensor('int64', BigInt64Array.from(values.map(BigInt)), size);
  const output = (await ort.session.run({ input_ids: tensor(ids), attention_mask: tensor(ids.map(() => 1)), token_type_ids: tensor(ids.map(() => 0)) })).last_hidden_state;
  const hidden = output.data as Float32Array; const width = output.dims[2];
  const pooled = new Float32Array(width);
  for (let token = 0; token < ids.length; token++) for (let i = 0; i < width; i++) pooled[i] += hidden[token * width + i] / ids.length;
  const norm = Math.hypot(...pooled) || 1;
  return pooled.map(value => value / norm);
}

/** A trained linear layer from embeddings to topics (see scripts/train-topic-head.ts). */
export type TopicHead = { version: number; labels: string[]; weights: number[][]; bias: number[] };
export function classify(vector: Float32Array, head: TopicHead): { label: string; confidence: number; probabilities: Record<string, number> } {
  const logits = head.weights.map((row, k) => row.reduce((sum, weight, i) => sum + weight * vector[i], head.bias[k]));
  const max = Math.max(...logits); const exps = logits.map(value => Math.exp(value - max)); const total = exps.reduce((a, b) => a + b, 0);
  const probabilities = Object.fromEntries(head.labels.map((label, k) => [label, exps[k] / total]));
  const best = logits.indexOf(max);
  return { label: head.labels[best], confidence: exps[best] / total, probabilities };
}
