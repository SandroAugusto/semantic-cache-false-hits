import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cosineSimilarity, evaluateThreshold, safeThreshold, sweepThresholds } from '../src/metrics.ts';
import type { ScoredPair } from '../src/types.ts';

const pair = (id: string, category: ScoredPair['category'], similarity: number): ScoredPair => ({
  id,
  category,
  label: category === 'paraphrase' ? 'same' : 'different',
  a: `a-${id}`,
  b: `b-${id}`,
  similarity,
});

const sample: ScoredPair[] = [
  pair('p1', 'paraphrase', 0.9),
  pair('p2', 'paraphrase', 0.8),
  pair('p3', 'paraphrase', 0.7),
  pair('h1', 'antonym', 0.95),
  pair('h2', 'negation', 0.78),
  pair('u1', 'unrelated', 0.5),
];

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual}`);

test('cosine: identical, orthogonal and opposite vectors', () => {
  close(cosineSimilarity([1, 2, 3], [1, 2, 3]), 1);
  close(cosineSimilarity([1, 0], [0, 1]), 0);
  close(cosineSimilarity([1, 1], [-1, -1]), -1);
});

test('cosine: ignores vector magnitude', () => {
  close(cosineSimilarity([1, 2], [2, 4]), 1);
});

test('cosine: rejects mismatched dimensions and zero vectors', () => {
  assert.throws(() => cosineSimilarity([1], [1, 2]));
  assert.throws(() => cosineSimilarity([0, 0], [1, 1]));
});

test('threshold: a hit is similarity >= threshold', () => {
  const row = evaluateThreshold(sample, 0.8);
  assert.equal(row.hitRate, 2 / 3); // p1 and p2
  assert.equal(row.hardNegativeFalseHitRate, 1 / 2); // only h1
  assert.equal(row.falseHitRate, 1 / 3); // h1 out of h1, h2, u1
  assert.equal(row.precision, 2 / 3); // p1, p2 correct; h1 wrong
  assert.equal(row.falseHitRateByCategory.antonym, 1);
  assert.equal(row.falseHitRateByCategory.negation, 0);
});

test('threshold: with no hits at all, precision is 1 by convention', () => {
  assert.equal(evaluateThreshold(sample, 0.99).precision, 1);
});

test('sweep: exact thresholds from 0.50 to 0.99, no floating-point drift', () => {
  const rows = sweepThresholds(sample);
  assert.equal(rows.length, 50);
  assert.equal(rows[0].threshold, 0.5);
  assert.equal(rows.at(-1)!.threshold, 0.99);
  assert.ok(rows.some((r) => r.threshold === 0.75));
});

test('safe threshold: sits above the worst hard negative and ignores unrelated pairs', () => {
  const safe = safeThreshold(sample)!;
  assert.equal(safe.threshold, 0.951);
  assert.equal(safe.hitRate, 0); // no paraphrase reaches 0.951
});

test('safe threshold: none exists when a hard negative has similarity 1', () => {
  const safe = safeThreshold([...sample, pair('h3', 'direction', 1)])!;
  assert.equal(safe.threshold, null);
});

test('policy: threshold + judge only hits when both agree', async () => {
  const { evaluatePolicy } = await import('../src/metrics.ts');
  const judgeSaysSame = new Set(['p1', 'p3', 'h1']);
  const row = evaluatePolicy(sample, (p) => p.similarity >= 0.75 && judgeSaysSame.has(p.id), 0.75);
  assert.equal(row.hitRate, 1 / 3); // p1 only: p3 is below the threshold, p2 rejected by the judge
  assert.equal(row.hardNegativeFalseHitRate, 1 / 2); // h1 passes both
  assert.equal(row.precision, 1 / 2);
});

test('percentile: nearest rank', async () => {
  const { percentile } = await import('../src/metrics.ts');
  assert.equal(percentile([5, 1, 3, 2, 4], 50), 3);
  assert.equal(percentile([5, 1, 3, 2, 4], 95), 5);
  assert.equal(percentile([7], 95), 7);
});
