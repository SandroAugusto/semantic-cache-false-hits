import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadPairs } from './dataset.ts';
import { OllamaEmbedder } from './embed.ts';
import { cosineSimilarity, safeThreshold, statsByCategory, sweepThresholds } from './metrics.ts';
import { renderMarkdown, renderPairsCsv, renderSweepCsv } from './report.ts';
import type { ScoredPair } from './types.ts';

const { values } = parseArgs({
  options: {
    model: { type: 'string', default: 'nomic-embed-text' },
    // "none" = no prefix. nomic-embed-text recommends task prefixes ("search_query: ", "clustering: ").
    prefix: { type: 'string', default: 'none' },
    host: { type: 'string', default: process.env.OLLAMA_HOST ?? 'http://localhost:11434' },
    data: { type: 'string', default: 'data/pairs.jsonl' },
    out: { type: 'string', default: 'results' },
    reference: { type: 'string', default: '0.75' },
  },
});

const prefix = values.prefix === 'none' ? '' : values.prefix!;
const referenceThreshold = Number(values.reference);
const slug = `${values.model}__${prefix ? prefix.replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, '') : 'no-prefix'}`;

const pairs = await loadPairs(values.data!);
const embedder = new OllamaEmbedder({
  model: values.model!,
  prefix,
  host: values.host!,
  cachePath: join(values.out!, '.embeddings-cache.json'),
});

console.log(`Embeddings: ${embedder.name}`);
const texts = pairs.flatMap((p) => [p.a, p.b]);
const vectors = await embedder.embed(texts);

const scored: ScoredPair[] = pairs.map((pair, i) => ({
  ...pair,
  similarity: cosineSimilarity(vectors[2 * i], vectors[2 * i + 1]),
}));

const rows = sweepThresholds(scored);
const report = renderMarkdown({
  embedderName: embedder.name,
  pairs: scored,
  rows,
  stats: statsByCategory(scored),
  referenceThreshold,
  safe: safeThreshold(scored),
});

const outDir = join(values.out!, slug);
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'report.md'), report);
await writeFile(join(outDir, 'pairs.csv'), renderPairsCsv(scored));
await writeFile(join(outDir, 'sweep.csv'), renderSweepCsv(rows));

console.log(report);
console.log(`Files written to ${outDir}/`);
