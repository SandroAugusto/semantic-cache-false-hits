/**
 * Track A: real patient questions (Medical Question Pairs) against a whole cache.
 *
 * Part 1, pairs: can any threshold separate doctor-written rewrites from related-but-different
 * questions written with similar keywords?
 *
 * Part 2, whole cache: every original question is stored in the cache. Queries are the rewrites
 * (should hit their own original) and the related questions (should miss). Each query retrieves
 * its top-k neighbors from the entire cache, so a wrong neighbor can win, as in production.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { OllamaEmbedder } from './embed.ts';
import { type Verdict, OllamaJudge } from './judge.ts';
import { cosineSimilarity, percentile } from './metrics.ts';
import { MQP_URL, loadMqp, seededShuffle } from './mqp.ts';
import { PROMPTS } from './prompts.ts';

const { values } = parseArgs({
  options: {
    data: { type: 'string', default: MQP_URL },
    sample: { type: 'string', default: '150' },
    seed: { type: 'string', default: '42' },
    k: { type: 'string', default: '3' },
    thresholds: { type: 'string', default: '0.55,0.6,0.65,0.7,0.75,0.8,0.85,0.9' },
    'judge-thresholds': { type: 'string', default: '0.6,0.7' },
    judge: { type: 'string', default: 'qwen2.5:3b' },
    prompt: { type: 'string', default: 'health' },
    'max-judge-calls': { type: 'string', default: '1500' },
    // Stop judging after this many minutes and report on the queries finished so far.
    'time-budget': { type: 'string', default: '35' },
    'embed-model': { type: 'string', default: 'nomic-embed-text' },
    prefix: { type: 'string', default: 'none' },
    host: { type: 'string', default: process.env.OLLAMA_HOST ?? 'http://localhost:11434' },
    out: { type: 'string', default: 'results' },
  },
});

const list = (value: string) => value.split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));
const sampleSize = Number(values.sample);
const k = Number(values.k);
const thresholds = list(values.thresholds!).sort((a, b) => a - b);
const judgeThresholds = list(values['judge-thresholds']!).sort((a, b) => a - b);
if (!PROMPTS[values.prompt!]) throw new Error(`Unknown prompt "${values.prompt}"`);

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const num = (v: number) => v.toFixed(3);

// ---------- Data and embeddings ----------
const items = await loadMqp(values.data!);
console.log(`Loaded ${items.length} MQP questions with one rewrite and one related question each.`);

const embedder = new OllamaEmbedder({
  model: values['embed-model']!,
  prefix: values.prefix === 'none' ? '' : values.prefix!,
  host: values.host!,
  cachePath: join(values.out!, '.embeddings-cache.json'),
});
const originals = await embedder.embed(items.map((i) => i.original));
const positives = await embedder.embed(items.map((i) => i.positive));
const negatives = await embedder.embed(items.map((i) => i.negative));

// ---------- Part 1: pairs ----------
const posSims = items.map((_, i) => cosineSimilarity(originals[i], positives[i]));
const negSims = items.map((_, i) => cosineSimilarity(originals[i], negatives[i]));
const share = (xs: number[], t: number) => xs.filter((x) => x >= t).length / xs.length;
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

const pairSweep: { threshold: number; reused: number; falseHits: number }[] = [];
for (let i = 50; i <= 99; i++) {
  const t = i / 100;
  pairSweep.push({ threshold: t, reused: share(posSims, t), falseHits: share(negSims, t) });
}
const worstNegative = Math.max(...negSims);
const safe = Math.ceil((worstNegative + 1e-9) * 1000) / 1000;
const onePercent = percentile(negSims, 99);
// Share of pairs where the related question is closer to the original than the rewrite is.
const inverted = items.filter((_, i) => negSims[i] >= posSims[i]).length / items.length;

// ---------- Part 2: whole cache ----------
interface Query {
  itemId: number;
  kind: 'rewrite' | 'related';
  text: string;
  top: { id: number; similarity: number }[];
}

const sampled = seededShuffle(items.map((i) => i.id), Number(values.seed)).slice(0, sampleSize);
const queries: Query[] = [];
for (const id of sampled) {
  for (const kind of ['rewrite', 'related'] as const) {
    const vector = kind === 'rewrite' ? positives[id] : negatives[id];
    const top = originals
      .map((cached, cachedId) => ({ id: cachedId, similarity: cosineSimilarity(vector, cached) }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
    queries.push({ itemId: id, kind, text: kind === 'rewrite' ? items[id].positive : items[id].negative, top });
  }
}

const lowestJudgeThreshold = judgeThresholds[0];
const plannedCalls = queries.reduce(
  (sum, q) => sum + q.top.filter((c) => c.similarity >= lowestJudgeThreshold).length,
  0,
);
console.log(
  `Cache: ${items.length} stored questions. Queries: ${queries.length}. ` +
    `Judge calls needed at most: ${plannedCalls} (top-${k}, threshold ${lowestJudgeThreshold}).`,
);
if (plannedCalls > Number(values['max-judge-calls'])) {
  throw new Error(`Would need ${plannedCalls} judge calls; limit is ${values['max-judge-calls']}. Lower --sample.`);
}

const judge = new OllamaJudge({
  model: values.judge!,
  promptName: values.prompt!,
  systemPrompt: PROMPTS[values.prompt!],
  host: values.host!,
  cachePath: join(values.out!, '.judge-cache.json'),
});
const verdicts = new Map<string, Verdict>();
const budgetMs = Number(values['time-budget']) * 60_000;
const judgingStarted = Date.now();
let done = 0;
for (const q of queries) {
  // Queries come in (rewrite, related) pairs; only stop between pairs so the sample stays balanced.
  if (done % 2 === 0 && Date.now() - judgingStarted > budgetMs) {
    console.log(`  time budget reached after ${done} queries; reporting on those.`);
    break;
  }
  for (const c of q.top.filter((c) => c.similarity >= lowestJudgeThreshold)) {
    // The new question first, the cached one second, as a real cache would ask.
    verdicts.set(`${q.kind}:${q.itemId}:${c.id}`, await judge.judge(q.text, items[c.id].original));
  }
  if (++done % 50 === 0) console.log(`  judged queries: ${done}/${queries.length}`);
}
// Verdicts are cached on disk, so a later run resumes where this one stopped.
const usedQueries = queries.slice(0, done);
const usedPairs = usedQueries.length / 2;
if (usedPairs === 0) throw new Error('No queries were judged within the time budget.');

interface Outcome {
  policy: string;
  threshold: number;
  rewriteCorrect: number;
  rewriteWrong: number;
  rewriteMiss: number;
  relatedWrong: number;
  judgeCallsPerQuery: number;
}

function simulate(policy: string, threshold: number, useJudge: boolean, depth: number): Outcome {
  let rewriteCorrect = 0;
  let rewriteWrong = 0;
  let relatedWrong = 0;
  let calls = 0;
  for (const q of usedQueries) {
    let served: number | null = null;
    for (const c of q.top.slice(0, depth)) {
      if (c.similarity < threshold) break; // Sorted: nothing further down passes either.
      if (!useJudge) { served = c.id; break; }
      calls++;
      if (verdicts.get(`${q.kind}:${q.itemId}:${c.id}`)!.same) { served = c.id; break; }
    }
    if (served === null) continue;
    if (q.kind === 'related') relatedWrong++;
    else if (served === q.itemId) rewriteCorrect++;
    else rewriteWrong++;
  }
  const rewrites = usedPairs;
  return {
    policy,
    threshold,
    rewriteCorrect: rewriteCorrect / rewrites,
    rewriteWrong: rewriteWrong / rewrites,
    rewriteMiss: (rewrites - rewriteCorrect - rewriteWrong) / rewrites,
    relatedWrong: relatedWrong / rewrites,
    judgeCallsPerQuery: calls / usedQueries.length,
  };
}

const outcomes: Outcome[] = thresholds.map((t) => simulate('threshold only (top-1)', t, false, 1));
for (const t of judgeThresholds) {
  outcomes.push(simulate(`threshold + judge (top-1)`, t, true, 1));
  outcomes.push(simulate(`threshold + judge (top-${k})`, t, true, k));
}

const latencies = [...verdicts.values()].map((v) => v.latencyMs);
const invalid = [...verdicts.values()].filter((v) => !v.valid).length;
const rank1Correct = usedQueries.filter((q) => q.kind === 'rewrite' && q.top[0].id === q.itemId).length / usedPairs;

// ---------- Report ----------
const lines: string[] = [];
lines.push('# Track A: real patient questions against a whole cache', '');
lines.push(
  'Data: [Medical Question Pairs](https://github.com/curai/medical-question-pair-dataset) (McCreery et al., KDD 2020): ' +
    `${items.length} real patient questions, each with a doctor-written **rewrite** (same intent) and a **related** question ` +
    'written with similar keywords whose answer would be wrong. The dataset is downloaded at run time and not stored here, ' +
    'so this report shows aggregates only.',
  '',
);
lines.push(`Embeddings: ${embedder.name}. Judge: ${judge.name}.`, '');

lines.push('## Part 1: pairs', '');
lines.push(`- Mean similarity, original vs. rewrite: **${num(mean(posSims))}**`);
lines.push(`- Mean similarity, original vs. related question: **${num(mean(negSims))}**`);
lines.push(`- Pairs where the related question is closer than the rewrite: **${pct(inverted)}**`);
lines.push(
  `- Safe threshold (no related question accepted): **${safe > 1 ? 'none' : safe}**, reusing **${pct(share(posSims, safe))}** of rewrites`,
);
lines.push(
  `- Threshold that accepts only 1% of related questions: **${num(onePercent)}**, reusing **${pct(share(posSims, onePercent))}** of rewrites`,
  '',
);
lines.push('| Threshold | Rewrites reused | Related questions accepted |', '|---:|---:|---:|');
for (const r of pairSweep.filter((r) => [0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95].some((t) => Math.abs(t - r.threshold) < 1e-9))) {
  lines.push(`| ${r.threshold.toFixed(2)} | ${pct(r.reused)} | ${pct(r.falseHits)} |`);
}
lines.push('');

lines.push('## Part 2: whole cache', '');
lines.push(
  `All ${items.length} originals are stored. ${usedQueries.length} queries (${usedPairs} rewrites and ${usedPairs} related ` +
    `questions, sampled with seed ${values.seed}) each search the entire cache for their top ${k} neighbors. ` +
    `The rewrite's own original is the nearest neighbor in **${pct(rank1Correct)}** of cases.`,
  '',
);
lines.push(
  '| Policy | Threshold | Rewrites: right answer | Rewrites: wrong answer | Rewrites: miss | Related: wrong answer | Judge calls per query |',
  '|---|---:|---:|---:|---:|---:|---:|',
);
for (const o of outcomes) {
  lines.push(
    `| ${o.policy} | ${o.threshold.toFixed(2)} | ${pct(o.rewriteCorrect)} | ${pct(o.rewriteWrong)} | ${pct(o.rewriteMiss)} | ${pct(o.relatedWrong)} | ${o.policy.startsWith('threshold only') ? '-' : o.judgeCallsPerQuery.toFixed(2)} |`,
  );
}
lines.push('');

lines.push('## Wrong answers per 1,000 queries, by traffic mix', '');
lines.push(
  'Real traffic mixes rewrites of cached questions with related-but-different ones. Nobody knows that mix without production ' +
    'data, so the table varies it. Both columns count only queries that have a close question in the cache; brand-new ' +
    'questions would mostly miss and are left out.',
  '',
);
const mixes = [0, 0.1, 0.25, 0.5];
lines.push(
  `| Policy | Threshold | ${mixes.map((m) => `${Math.round(m * 100)}% related: wrong / saved`).join(' | ')} |`,
  `|---|---:|${mixes.map(() => '---:').join('|')}|`,
);
for (const o of outcomes.filter((o) => [0.6, 0.7, 0.8].some((t) => Math.abs(t - o.threshold) < 1e-9))) {
  const cells = mixes.map((m) => {
    const wrong = 1000 * ((1 - m) * o.rewriteWrong + m * o.relatedWrong);
    const saved = 1000 * (1 - m) * o.rewriteCorrect;
    return `${Math.round(wrong)} / ${Math.round(saved)}`;
  });
  lines.push(`| ${o.policy} | ${o.threshold.toFixed(2)} | ${cells.join(' | ')} |`);
}
lines.push('');

lines.push('## Judge cost', '');
lines.push(
  `${verdicts.size} judge calls, ${invalid} invalid replies. Latency on this runner: mean ${Math.round(mean(latencies))} ms, ` +
    `p95 ${Math.round(percentile(latencies, 95))} ms.`,
  '',
);

lines.push('## Caveats', '');
lines.push('- The related questions were written on purpose to share keywords with the original: they are realistic in wording, not in frequency.');
lines.push('- Rewrites may change details the doctor judged irrelevant (for example, an age). A strict judge can call those "different", which lowers savings but not safety.');
lines.push(`- ${usedPairs} sampled queries per kind: at ${pct(1 / usedPairs)} per query, small rates are noisy.`);
if (usedPairs < sampleSize) {
  lines.push(`- The time budget stopped judging after ${usedPairs} of the ${sampleSize} planned pairs; rerunning the workflow resumes from the cached verdicts.`);
}
lines.push('');

const outDir = join(values.out!, 'mqp');
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'report.md'), lines.join('\n'));
await writeFile(
  join(outDir, 'pair-sweep.csv'),
  ['threshold,rewrites_reused,related_accepted', ...pairSweep.map((r) => `${r.threshold.toFixed(2)},${r.reused.toFixed(4)},${r.falseHits.toFixed(4)}`)].join('\n') + '\n',
);
await writeFile(
  join(outDir, 'cache-sim.csv'),
  [
    'policy,threshold,rewrite_correct,rewrite_wrong,rewrite_miss,related_wrong,judge_calls_per_query',
    ...outcomes.map((o) =>
      [`"${o.policy}"`, o.threshold.toFixed(2), o.rewriteCorrect, o.rewriteWrong, o.rewriteMiss, o.relatedWrong, o.judgeCallsPerQuery]
        .map((v) => (typeof v === 'number' ? v.toFixed(4) : v))
        .join(','),
    ),
  ].join('\n') + '\n',
);
console.log(lines.join('\n'));
console.log(`Files written to ${outDir}/`);
