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
import { cosineSimilarity, evaluatePolicy, evaluateThreshold, percentile } from './metrics.ts';
import { PROMPTS } from './prompts.ts';
import { CATEGORIES, type ScoredPair, type ThresholdRow } from './types.ts';

const { values } = parseArgs({
  options: {
    judges: { type: 'string', default: 'qwen2.5:3b,llama3.2:3b,qwen2.5:7b' },
    prompts: { type: 'string', default: 'plain,guided' },
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
  verdicts: Map<string, Verdict>;
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
    // Every pair is judged, so judge accuracy can be read on its own, not only behind the threshold.
    for (const pair of scored) verdicts.set(pair.id, await judge.judge(pair.a, pair.b));
    runs.push({ name: judge.name, verdicts });
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
  '"Judge calls" is the share of pairs whose similarity reaches the threshold, i.e. how often the judge would run.',
  '',
);
lines.push(
  '| Policy | Threshold | Paraphrases reused | Hard negatives accepted | Unrelated accepted | Precision | Judge calls |',
  '|---|---:|---:|---:|---:|---:|---:|',
);

interface PipelineRow extends ThresholdRow {
  policy: string;
  judgeCallRate: number;
}
const pipelineRows: PipelineRow[] = [];
for (const threshold of thresholds) {
  const candidates = scored.filter((p) => p.similarity >= threshold).length / scored.length;
  pipelineRows.push({ ...evaluateThreshold(scored, threshold), policy: 'threshold only', judgeCallRate: 0 });
  for (const run of runs) {
    const row = evaluatePolicy(
      scored,
      (p) => p.similarity >= threshold && run.verdicts.get(p.id)!.same,
      threshold,
    );
    pipelineRows.push({ ...row, policy: run.name, judgeCallRate: candidates });
  }
}
for (const row of pipelineRows) {
  lines.push(
    `| ${row.policy} | ${row.threshold.toFixed(2)} | ${pct(row.hitRate)} | ${pct(row.hardNegativeFalseHitRate)} | ` +
      `${pct(row.falseHitRateByCategory.unrelated ?? 0)} | ${pct(row.precision)} | ${row.policy === 'threshold only' ? '-' : pct(row.judgeCallRate)} |`,
  );
}
lines.push('');

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
const judgmentsCsv = ['judge,id,category,label,similarity,judge_same,valid,latency_ms'];
for (const run of runs) {
  for (const p of scored) {
    const v = run.verdicts.get(p.id)!;
    judgmentsCsv.push(
      [csvEscape(run.name), p.id, p.category, p.label, p.similarity.toFixed(6), v.same, v.valid, v.latencyMs.toFixed(1)].join(','),
    );
  }
}
await writeFile(join(outDir, 'judgments.csv'), judgmentsCsv.join('\n') + '\n');

const pipelineCsv = ['policy,threshold,hit_rate,hard_negative_false_hit_rate,false_hit_rate,precision,judge_call_rate'];
for (const r of pipelineRows) {
  pipelineCsv.push(
    [csvEscape(r.policy), r.threshold.toFixed(2), r.hitRate.toFixed(4), r.hardNegativeFalseHitRate.toFixed(4), r.falseHitRate.toFixed(4), r.precision.toFixed(4), r.judgeCallRate.toFixed(4)].join(','),
  );
}
await writeFile(join(outDir, 'pipeline.csv'), pipelineCsv.join('\n') + '\n');

console.log(lines.join('\n'));
console.log(`Files written to ${outDir}/`);
