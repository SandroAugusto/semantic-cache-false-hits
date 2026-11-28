/**
 * Cross-encoder baseline: the objection to an LLM judge is "why not a model trained for
 * question equivalence?". A cross-encoder reads both questions together and outputs a
 * duplicate probability, in milliseconds on a CPU.
 *
 *   npm run rerank -- [--model cross-encoder/quora-distilroberta-base] [--revision main]
 *
 * Part 1 scores the 56 hand-written pairs (data/pairs.jsonl), combined with the cosine
 * similarities already in results/<embeddings>/pairs.csv, so no Ollama is needed.
 * Part 2 scores every MQP original against its rewrite and its related question (downloaded
 * at run time, aggregates only). Writes results/rerank/report.md and CSVs.
 *
 * The model runs through Transformers.js (ONNX Runtime, CPU). Its files are downloaded from
 * the Hugging Face Hub on first use; `--revision` pins a commit. `--local-dir` loads it from
 * disk instead.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { parseCsvRecords } from './csv.ts';
import {
  type PairScore,
  type RerankRow,
  duplicateProbabilities,
  rerankRow,
  thresholdForFalseHits,
} from './cross-encoder.ts';
import { loadPairs } from './dataset.ts';
import { thresholdGrid } from './metrics.ts';
import { MQP_URL, loadMqp } from './mqp.ts';
import { HARD_NEGATIVE_CATEGORIES } from './types.ts';

const { values } = parseArgs({
  options: {
    model: { type: 'string', default: 'cross-encoder/quora-distilroberta-base' },
    revision: { type: 'string', default: 'main' },
    data: { type: 'string', default: 'data/pairs.jsonl' },
    similarities: { type: 'string', default: 'results/nomic-embed-text__no-prefix/pairs.csv' },
    'min-similarity': { type: 'string', default: '0.6' },
    mqp: { type: 'string', default: MQP_URL },
    'batch-size': { type: 'string', default: '16' },
    out: { type: 'string', default: 'results' },
    // Load the model from <local-dir>/<model> instead of the Hub (offline runs and tests).
    'local-dir': { type: 'string' },
  },
});
const minSimilarity = Number(values['min-similarity']);
const batchSize = Number(values['batch-size']);
if (!Number.isInteger(batchSize) || batchSize < 1) throw new Error('--batch-size must be a positive integer');

// Loaded here, not at the top, so the rest of the repository never pulls in ONNX Runtime.
const { AutoModelForSequenceClassification, AutoTokenizer, env } = await import('@huggingface/transformers');
if (values['local-dir'] !== undefined) {
  env.localModelPath = values['local-dir'];
  env.allowRemoteModels = false;
}
console.log(`Loading ${values.model}@${values.revision}...`);
const tokenizer = await AutoTokenizer.from_pretrained(values.model!, { revision: values.revision! });
const model = await AutoModelForSequenceClassification.from_pretrained(values.model!, {
  revision: values.revision!,
  dtype: 'fp32',
});

const latenciesMs: number[] = [];
async function score(pairs: readonly (readonly [string, string])[]): Promise<number[]> {
  const scores: number[] = [];
  for (let i = 0; i < pairs.length; i += batchSize) {
    const batch = pairs.slice(i, i + batchSize);
    const started = performance.now();
    const inputs = tokenizer(
      batch.map(([a]) => a),
      { text_pair: batch.map(([, b]) => b), padding: true, truncation: true },
    );
    const { logits } = (await model(inputs)) as { logits: { data: ArrayLike<number>; dims: number[] } };
    const elapsed = performance.now() - started;
    for (let j = 0; j < batch.length; j++) latenciesMs.push(elapsed / batch.length);
    scores.push(...duplicateProbabilities(logits.data, logits.dims));
  }
  return scores;
}

const grid = thresholdGrid(0.05, 0.95, 0.05);
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const lines: string[] = [];
lines.push('# Cross-encoder baseline', '');
lines.push(
  `Model: \`${values.model}\` at revision \`${values.revision}\`, through Transformers.js on CPU (fp32). ` +
    'Score: the model\'s duplicate probability. A pair is accepted when the score reaches the threshold.',
  '',
);

// ---------- Part 1: hand-written pairs ----------
const pairs = await loadPairs(values.data!);
const similarityById = new Map(
  parseCsvRecords(await readFile(values.similarities!, 'utf8')).map((r) => [r.id, Number(r.similarity)]),
);
const handScores = await score(pairs.map((p) => [p.a, p.b] as const));
const hand: (PairScore & { id: string; category: string })[] = pairs.map((p, i) => ({
  id: p.id,
  category: p.category,
  same: p.label === 'same',
  score: handScores[i],
  similarity: similarityById.get(p.id),
}));
const hardOnly = hand.filter((p) => p.same || HARD_NEGATIVE_CATEGORIES.includes(p.category as never));

lines.push('## Part 1: the 56 hand-written pairs', '');
lines.push(
  `"Paraphrases reused" against "hard negatives accepted" (the six same-topic categories), for the cross-encoder ` +
    `alone and behind a cosine threshold of ${minSimilarity} (similarities from \`${values.similarities}\`), ` +
    'the setting of Experiment 2.',
  '',
);
lines.push(
  '| Threshold | Reused (alone) | Hard negatives accepted (alone) | Reused (cosine + cross-encoder) | Hard negatives accepted (cosine + cross-encoder) |',
  '|---:|---:|---:|---:|---:|',
);
const handRows: { alone: RerankRow; combined: RerankRow }[] = grid.map((t) => ({
  alone: rerankRow(hardOnly, t),
  combined: rerankRow(hardOnly, t, minSimilarity),
}));
for (const { alone, combined } of handRows) {
  lines.push(
    `| ${alone.threshold.toFixed(2)} | ${pct(alone.reused)} | ${pct(alone.falseHits)} | ${pct(combined.reused)} | ${pct(combined.falseHits)} |`,
  );
}
lines.push('');
const worst = [...hand].filter((p) => !p.same).sort((a, b) => b.score - a.score).slice(0, 5);
lines.push('Highest-scoring pairs that should not be reused:', '');
lines.push('| Id | Category | Score |', '|---|---|---:|');
for (const p of worst) lines.push(`| ${p.id} | ${p.category} | ${p.score.toFixed(3)} |`);
lines.push('');

// ---------- Part 2: MQP ----------
const items = await loadMqp(values.mqp!);
console.log(`Scoring ${items.length * 2} MQP pairs...`);
const positives = await score(items.map((i) => [i.original, i.positive] as const));
const negatives = await score(items.map((i) => [i.original, i.negative] as const));
const mqp: PairScore[] = [
  ...positives.map((score) => ({ same: true, score })),
  ...negatives.map((score) => ({ same: false, score })),
];
const mqpRows = grid.map((t) => rerankRow(mqp, t));

lines.push('## Part 2: Medical Question Pairs, pair level', '');
lines.push(
  `${items.length} real patient questions, each scored against its doctor-written rewrite (should be reused) ` +
    'and its related question (should not). Compare with Track A, Part 1, where the cosine threshold that ' +
    'accepts at most 1% of related questions reuses 29.5% of rewrites (results/mqp/report.md).',
  '',
);
lines.push('| Threshold | Rewrites reused | Related questions accepted |', '|---:|---:|---:|');
for (const r of mqpRows) lines.push(`| ${r.threshold.toFixed(2)} | ${pct(r.reused)} | ${pct(r.falseHits)} |`);
lines.push('');
for (const target of [0.05, 0.01]) {
  const row = thresholdForFalseHits(mqpRows, target);
  lines.push(
    row === null
      ? `- No threshold on the grid keeps related questions at or below ${pct(target)}.`
      : `- At most ${pct(target)} of related questions accepted: threshold ${row.threshold.toFixed(2)}, ` +
          `${pct(row.reused)} of rewrites reused (${pct(row.falseHits)} related accepted).`,
  );
}
lines.push('');

// ---------- Cost ----------
const sorted = [...latenciesMs].sort((a, b) => a - b);
const mean = latenciesMs.reduce((s, v) => s + v, 0) / latenciesMs.length;
const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)];
lines.push('## Cost', '');
lines.push(
  `${latenciesMs.length} pairs scored in batches of ${batchSize}. Per pair: mean ${mean.toFixed(1)} ms, ` +
    `p95 of batch averages ${p95.toFixed(1)} ms, on this machine's CPU. Batch averages understate the ` +
    'latency of a single query scored alone.',
  '',
);
lines.push('## Limits', '');
lines.push(
  '- The model was trained on Quora question pairs, not medical or clinical-trial questions.',
  '- Part 1 has 5 pairs per hard-negative category; each pair is 20 percentage points of its category.',
  '- Part 2 is pair level only: each query against its own original, not against the whole cache.',
  '',
);

const outDir = join(values.out!, 'rerank');
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'report.md'), lines.join('\n'));
await writeFile(
  join(outDir, 'pairs.csv'),
  ['id,category,label,similarity,score', ...hand.map((p) => `${p.id},${p.category},${p.same ? 'same' : 'different'},${p.similarity ?? ''},${p.score.toFixed(6)}`)].join('\n') + '\n',
);
await writeFile(
  join(outDir, 'mqp-sweep.csv'),
  ['threshold,rewrites_reused,related_accepted', ...mqpRows.map((r) => `${r.threshold},${r.reused.toFixed(4)},${r.falseHits.toFixed(4)}`)].join('\n') + '\n',
);
console.log(lines.join('\n'));
console.log(`Files written to ${outDir}/`);
