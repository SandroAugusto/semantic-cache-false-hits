import type { SafeThreshold } from './metrics.ts';
import type { CategoryStats, ScoredPair, ThresholdRow } from './types.ts';

const pct = (value: number) => `${(value * 100).toFixed(0)}%`;
const num = (value: number) => value.toFixed(3);

interface ReportInput {
  embedderName: string;
  pairs: ScoredPair[];
  rows: ThresholdRow[];
  stats: CategoryStats[];
  referenceThreshold: number;
  safe: SafeThreshold | null;
}

export function renderMarkdown(input: ReportInput): string {
  const { embedderName, pairs, rows, stats, referenceThreshold, safe } = input;
  const reference = rows.find((r) => Math.abs(r.threshold - referenceThreshold) < 1e-9);
  const categories = Object.keys(rows[0]?.falseHitRateByCategory ?? {});
  const highlighted = new Set([0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, referenceThreshold]);
  const tableRows = rows.filter((r) => [...highlighted].some((t) => Math.abs(t - r.threshold) < 1e-9));

  const lines: string[] = [];
  lines.push(`# Results: ${embedderName}`, '');
  lines.push(`Pairs evaluated: ${pairs.length}. Cache hit = similarity >= threshold.`, '');

  if (reference) {
    lines.push(`## At the reference threshold (${referenceThreshold})`, '');
    lines.push(`- Paraphrases reused: **${pct(reference.hitRate)}**`);
    lines.push(`- Hard negatives served as if they were the same question: **${pct(reference.hardNegativeFalseHitRate)}**`);
    lines.push(`- Precision of what the cache returns: **${pct(reference.precision)}**`, '');
  }

  if (safe?.threshold === null) {
    lines.push('## Safe threshold in this dataset', '');
    lines.push('None: a hard negative has similarity 1, so no threshold separates it from the original question.', '');
  } else if (safe) {
    lines.push('## Safe threshold in this dataset', '');
    lines.push(
      `Lowest threshold with no hard negative becoming a hit: **${safe.threshold}**. ` +
        `At that point the cache reuses **${pct(safe.hitRate)}** of the paraphrases.`,
      '',
    );
  }

  lines.push('## Similarity by category', '');
  lines.push('| Category | Pairs | Min | Mean | Max |', '|---|---:|---:|---:|---:|');
  for (const s of stats) lines.push(`| ${s.category} | ${s.count} | ${num(s.min)} | ${num(s.mean)} | ${num(s.max)} |`);
  lines.push('');

  lines.push('## Threshold sweep', '');
  lines.push(
    `| Threshold | Paraphrases reused | Hard negatives accepted | Precision | ${categories.join(' | ')} |`,
    `|---:|---:|---:|---:|${categories.map(() => '---:').join('|')}|`,
  );
  for (const r of tableRows) {
    const byCategory = categories.map((c) => pct(r.falseHitRateByCategory[c]));
    lines.push(
      `| ${r.threshold.toFixed(2)} | ${pct(r.hitRate)} | ${pct(r.hardNegativeFalseHitRate)} | ${pct(r.precision)} | ${byCategory.join(' | ')} |`,
    );
  }
  lines.push('');

  lines.push('## Most dangerous hard negatives', '');
  lines.push('Different-meaning pairs with the highest similarity: the first ones to leak through the cache.', '');
  lines.push('| Similarity | Category | Original question | New question |', '|---:|---|---|---|');
  const dangerous = pairs
    .filter((p) => p.label === 'different')
    .sort((x, y) => y.similarity - x.similarity)
    .slice(0, 10);
  for (const p of dangerous) lines.push(`| ${num(p.similarity)} | ${p.category} | ${p.a} | ${p.b} |`);
  lines.push('');

  lines.push('## Hardest paraphrases', '');
  lines.push('Lowest similarity: the cache only reuses these with a low threshold.', '');
  lines.push('| Similarity | Original question | New question |', '|---:|---|---|');
  const hardParaphrases = pairs
    .filter((p) => p.label === 'same')
    .sort((x, y) => x.similarity - y.similarity)
    .slice(0, 5);
  for (const p of hardParaphrases) lines.push(`| ${num(p.similarity)} | ${p.a} | ${p.b} |`);
  lines.push('');

  return lines.join('\n');
}

export function renderPairsCsv(pairs: ScoredPair[]): string {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const header = 'id,category,label,similarity,a,b';
  const body = pairs.map((p) => [p.id, p.category, p.label, p.similarity.toFixed(6), escape(p.a), escape(p.b)].join(','));
  return [header, ...body].join('\n') + '\n';
}

export function renderSweepCsv(rows: ThresholdRow[]): string {
  const categories = Object.keys(rows[0]?.falseHitRateByCategory ?? {});
  const header = ['threshold', 'hit_rate', 'false_hit_rate', 'hard_negative_false_hit_rate', 'precision', ...categories];
  const body = rows.map((r) =>
    [
      r.threshold.toFixed(2),
      r.hitRate.toFixed(4),
      r.falseHitRate.toFixed(4),
      r.hardNegativeFalseHitRate.toFixed(4),
      r.precision.toFixed(4),
      ...categories.map((c) => r.falseHitRateByCategory[c].toFixed(4)),
    ].join(','),
  );
  return [header.join(','), ...body].join('\n') + '\n';
}
