/**
 * Experiment 2: verify before serving from cache.
 *
 * The embedding threshold only proposes a candidate; a small LLM judge then decides whether
 * the stored answer really answers the new question. A cache hit requires both:
 *
 *   hit = similarity >= threshold AND judge says "same"
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadPairs } from './dataset.ts';
import { OllamaEmbedder } from './embed.ts';
import { type Verdict, OllamaJudge } from './judge.ts';
import { cosineSimilarity, evaluatePolicy, evaluateThreshold, judgeLoad, percentile } from './metrics.ts';
import { shortDigest } from './ollama-models.ts';
import { PROMPTS } from './prompts.ts';
import { CATEGORIES, type ScoredPair, type ThresholdRow } from './types.ts';

const { values } = parseArgs({
  options: {
    judges: { type: 'string', default: 'qwen2.5:3b,llama3.2:3b,qwen2.5:7b' },
    prompts: { type: 'string', default: 'plain,guided' },
    // "ab": each pair judged as given. "ab,ba": also with the questions swapped, to measure symmetry.
    orders: { type: 'string', default: 'ab,ba' },
    thresholds: { type: 'string', default: '0.6,0.65,0.7,0.75' },
    'embed-model': { type: 'string', default: 'nomic-embed-text' },
    prefix: { type: 'string', default: 'none' },
    host: { type: 'string', default: process.env.OLLAMA_HOST ?? 'http://localhost:11434' },
    data: { type: 'string', default: 'data/pairs.jsonl' },
    out: { type: 'string', default: 'results' },
  },
});

const list = (value: string) => value.split(',').map((s) => s.trim()).filter(Boolean);
const judgeModels = list(values.judges!);
const promptNames = list(values.prompts!);
const thresholds = list(values.thresholds!).map(Number);
for (const name of promptNames) if (!PROMPTS[name]) throw new Error(`Unknown prompt "${name}"`);
const orders = list(values.orders!);
if (!orders.includes('ab') || orders.some((o) => o !== 'ab' && o !== 'ba')) {
  throw new Error(`--orders must be "ab" or "ab,ba", got "${values.orders}"`);
}
const bothOrders = orders.includes('ba');

const pairs = await loadPairs(values.data!);
const prefix = values.prefix === 'none' ? '' : values.prefix!;
const embedder = new OllamaEmbedder({
  model: values['embed-model']!,
  prefix,
  host: values.host!,
  cachePath: join(values.out!, '.embeddings-cache.json'),
});
const vectors = await embedder.embed(pairs.flatMap((p) => [p.a, p.b]));
const scored: ScoredPair[] = pairs.map((pair, i) => ({
  ...pair,
  similarity: cosineSimilarity(vectors[2 * i], vectors[2 * i + 1]),
}));

interface JudgeRun {
  name: string;
  digest: string;
  verdicts: Map<string, Verdict>;
  /** The same pairs with the questions swapped (B then A); empty unless --orders includes "ba". */
  reversed: Map<string, Verdict>;
}

const runs: JudgeRun[] = [];
for (const model of judgeModels) {
  for (const promptName of promptNames) {
    const judge = new OllamaJudge({
      model,
      promptName,
      systemPrompt: PROMPTS[promptName],
      host: values.host!,
      cachePath: join(values.out!, '.judge-cache.json'),
    });
    console.log(`Judging ${pairs.length} pairs with ${judge.name}...`);
    const verdicts = new Map<string, Verdict>();
    const reversed = new Map<string, Verdict>();
    // Every pair is judged, so judge accuracy can be read on its own, not only behind the threshold.
    for (const pair of scored) {
      verdicts.set(pair.id, await judge.judge(pair.a, pair.b));
      if (bothOrders) reversed.set(pair.id, await judge.judge(pair.b, pair.a));
    }
    runs.push({ name: judge.name, digest: judge.digest ?? '', verdicts, reversed });
  }
}

const pct = (value: number) => `${(value * 100).toFixed(0)}%`;
const ms = (value: number) => `${Math.round(value)} ms`;
const lines: string[] = [];

lines.push('# Experiment 2: verify before serving from cache', '');
lines.push(
  `Embeddings: ${embedder.name}. A hit requires similarity >= threshold **and** the judge saying both ` +
    'questions share one answer. Pairs evaluated: ' +
    `${scored.length}.`,
  '',
  `Weights (Ollama digests): ${values['embed-model']} ${shortDigest(embedder.digest ?? '')}, ` +
    [...new Map(runs.map((r) => [r.name.split(' ')[0], r.digest])).entries()]
      .map(([model, digest]) => `${model} ${shortDigest(digest)}`)
      .join(', ') +
    '.',
  '',
);
lines.push(
  '> The `guided` prompt names the kinds of change this dataset tests (negation, direction, numbers, ' +
    'entities, scope), so it is tuned to the test set. Read its scores as an upper bound.',
  '',
);

// 1. The judge on its own.
lines.push('## The judge on its own', '');
lines.push('Share of pairs each judge classifies correctly, by category.', '');
lines.push(
  `| Judge | ${CATEGORIES.join(' | ')} | Invalid replies | Mean latency | p95 latency |`,
  `|---|${CATEGORIES.map(() => '---:').join('|')}|---:|---:|---:|`,
);
for (const run of runs) {
  const accuracy = CATEGORIES.map((category) => {
    const ofCategory = scored.filter((p) => p.category === category);
    const correct = ofCategory.filter((p) => run.verdicts.get(p.id)!.same === (p.label === 'same')).length;
    return pct(correct / ofCategory.length);
  });
  const all = [...run.verdicts.values()];
  const latencies = all.map((v) => v.latencyMs);
  const mean = latencies.reduce((s, v) => s + v, 0) / latencies.length;
  lines.push(
    `| ${run.name} | ${accuracy.join(' | ')} | ${all.filter((v) => !v.valid).length} | ${ms(mean)} | ${ms(percentile(latencies, 95))} |`,
  );
}
lines.push('');

// 2. Threshold + judge vs. threshold alone.
lines.push('## Threshold alone vs. threshold + judge', '');
lines.push(
  '"Pairs judged" is the share of pairs whose similarity reaches the threshold, i.e. how often the judge would run. ' +
    '"Judge calls per pair" is the inference volume: the same share for a policy that asks once, twice that for ' +
    'a both-orders policy, which asks the judge twice about every candidate.',
  '',
);
lines.push(
  '"Break-even generation" is the generation time above which the judge saves time: a judge call costs the ' +
    'mean judge latency, and only the calls that end in a hit save a generation, so the break-even is the mean ' +
    'judge latency divided by the share of judge calls that end in a hit. Below it, calling the model directly ' +
    'is faster. Latencies are from these CPU runners.',
  '',
);
lines.push(
  '| Policy | Threshold | Paraphrases reused | Hard negatives accepted | Unrelated accepted | Precision | Pairs judged | Judge calls per pair | Break-even generation |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
);

interface PipelineRow extends ThresholdRow {
  policy: string;
  /** Share of pairs sent to the judge (similarity >= threshold); 0 without a judge. */
  judgeCallRate: number;
  /** Judge calls per pair evaluated: judgeCallRate times the calls per candidate (2 for both orders). */
  judgeCallsPerPair: number;
  /** Mean judge latency / share of judge calls that end in a hit, in ms; null without judge or hits. */
  breakEvenMs: number | null;
}
const meanLatency = (verdicts: Iterable<Verdict>) => {
  const all = [...verdicts].map((v) => v.latencyMs);
  return all.reduce((s, v) => s + v, 0) / all.length;
};
const pipelineRows: PipelineRow[] = [];
for (const threshold of thresholds) {
  pipelineRows.push({
    ...evaluateThreshold(scored, threshold),
    policy: 'threshold only',
    judgeCallRate: 0,
    judgeCallsPerPair: 0,
    breakEvenMs: null,
  });
  const candidateCount = scored.filter((p) => p.similarity >= threshold).length;
  for (const run of runs) {
    // Policy name, verdict, mean judge latency per candidate, judge calls per candidate.
    const policies: [string, (p: ScoredPair) => boolean, number, number][] = [
      [run.name, (p) => run.verdicts.get(p.id)!.same, meanLatency(run.verdicts.values()), 1],
    ];
    if (bothOrders) {
      // Both orders must say "same": two calls per candidate.
      policies.push([
        `${run.name}, both orders`,
        (p) => run.verdicts.get(p.id)!.same && run.reversed.get(p.id)!.same,
        meanLatency(run.verdicts.values()) + meanLatency(run.reversed.values()),
        2,
      ]);
    }
    for (const [policy, says, latencyMs, callsPerCandidate] of policies) {
      const isHit = (p: ScoredPair) => p.similarity >= threshold && says(p);
      const hits = scored.filter(isHit).length;
      const load = judgeLoad(scored, threshold, callsPerCandidate);
      pipelineRows.push({
        ...evaluatePolicy(scored, isHit, threshold),
        policy,
        judgeCallRate: load.candidateRate,
        judgeCallsPerPair: load.callsPerPair,
        breakEvenMs: hits === 0 ? null : latencyMs / (hits / candidateCount),
      });
    }
  }
}
for (const row of pipelineRows) {
  lines.push(
    `| ${row.policy} | ${row.threshold.toFixed(2)} | ${pct(row.hitRate)} | ${pct(row.hardNegativeFalseHitRate)} | ` +
      `${pct(row.falseHitRateByCategory.unrelated ?? 0)} | ${pct(row.precision)} | ` +
      `${row.policy === 'threshold only' ? '-' : pct(row.judgeCallRate)} | ` +
      `${row.policy === 'threshold only' ? '-' : row.judgeCallsPerPair.toFixed(2)} | ` +
      `${row.breakEvenMs === null ? '-' : ms(row.breakEvenMs)} |`,
  );
}
lines.push('');

if (bothOrders) {
  lines.push('## Order symmetry', '');
  lines.push(
    'Each pair judged twice, A then B and B then A. A judge that answers differently for the same two ' +
      'questions is not deciding on meaning alone.',
    '',
  );
  lines.push('| Judge | Pairs answered differently by order | Of them, hard negatives |', '|---|---:|---:|');
  for (const run of runs) {
    const flipped = scored.filter((p) => run.verdicts.get(p.id)!.same !== run.reversed.get(p.id)!.same);
    const hard = flipped.filter((p) => p.label === 'different' && p.category !== 'unrelated');
    lines.push(`| ${run.name} | ${flipped.length} of ${scored.length} | ${hard.length} |`);
  }
  lines.push('');
}

// 3. Where each judge gets it wrong.
lines.push('## Judge mistakes', '');
for (const run of runs) {
  const wrong = scored.filter((p) => run.verdicts.get(p.id)!.same !== (p.label === 'same'));
  lines.push(`### ${run.name}: ${wrong.length} of ${scored.length} pairs wrong`, '');
  if (wrong.length === 0) continue;
  lines.push('| Category | Expected | Judge said | Question A | Question B |', '|---|---|---|---|---|');
  for (const p of wrong) {
    const said = run.verdicts.get(p.id)!.same ? 'same' : 'different';
    lines.push(`| ${p.category} | ${p.label} | ${said} | ${p.a} | ${p.b} |`);
  }
  lines.push('');
}

const outDir = join(values.out!, 'verification');
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'report.md'), lines.join('\n'));

const csvEscape = (value: string) => `"${value.replaceAll('"', '""')}"`;
const judgmentsCsv = ['judge,id,order,category,label,similarity,judge_same,valid,latency_ms'];
for (const run of runs) {
  for (const p of scored) {
    for (const [order, verdicts] of [['ab', run.verdicts], ['ba', run.reversed]] as const) {
      const v = verdicts.get(p.id);
      if (!v) continue;
      judgmentsCsv.push(
        [csvEscape(run.name), p.id, order, p.category, p.label, p.similarity.toFixed(6), v.same, v.valid, v.latencyMs.toFixed(1)].join(','),
      );
    }
  }
}
await writeFile(join(outDir, 'judgments.csv'), judgmentsCsv.join('\n') + '\n');

const pipelineCsv = ['policy,threshold,hit_rate,hard_negative_false_hit_rate,false_hit_rate,precision,judge_call_rate,break_even_ms,judge_calls_per_pair'];
for (const r of pipelineRows) {
  pipelineCsv.push(
    [csvEscape(r.policy), r.threshold.toFixed(2), r.hitRate.toFixed(4), r.hardNegativeFalseHitRate.toFixed(4), r.falseHitRate.toFixed(4), r.precision.toFixed(4), r.judgeCallRate.toFixed(4), r.breakEvenMs === null ? '' : r.breakEvenMs.toFixed(0), r.judgeCallsPerPair.toFixed(4)].join(','),
  );
}
await writeFile(join(outDir, 'pipeline.csv'), pipelineCsv.join('\n') + '\n');

console.log(lines.join('\n'));
console.log(`Files written to ${outDir}/`);
