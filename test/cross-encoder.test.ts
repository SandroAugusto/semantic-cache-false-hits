import assert from 'node:assert/strict';
import { test } from 'node:test';
import { duplicateProbabilities, rerankRow, thresholdForFalseHits } from '../src/cross-encoder.ts';
import { findDigest, shortDigest } from '../src/ollama-models.ts';

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual}`);

test('one logit per pair: sigmoid', () => {
  // sigmoid(0) = 0.5; sigmoid(ln 3) = 3 / 4.
  const [a, b] = duplicateProbabilities([0, Math.log(3)], [2, 1]);
  close(a, 0.5);
  close(b, 0.75);
});

test('two logits per pair: softmax of the second class', () => {
  // e^1 / (e^0 + e^1) = 0.7310585786300049, computed separately.
  const [a, b] = duplicateProbabilities(new Float32Array([0, 1, 5, 5]), [2, 2]);
  assert.ok(Math.abs(a - 0.7310585786300049) < 1e-7);
  close(b, 0.5);
});

test('large logits do not overflow', () => {
  const [p] = duplicateProbabilities([1000, -1000], [1, 2]);
  close(p, 0);
});

test('logits of the wrong shape are refused', () => {
  assert.throws(() => duplicateProbabilities([0, 1, 2], [1, 3]));
  assert.throws(() => duplicateProbabilities([0, 1], [3, 1]));
  assert.throws(() => duplicateProbabilities([0], [1]));
});

const scored = [
  { same: true, score: 0.9, similarity: 0.8 },
  { same: true, score: 0.4, similarity: 0.9 },
  { same: false, score: 0.95, similarity: 0.5 },
  { same: false, score: 0.2, similarity: 0.9 },
];

test('rerankRow: shares of same and different pairs accepted', () => {
  assert.deepEqual(rerankRow(scored, 0.5), { threshold: 0.5, reused: 0.5, falseHits: 0.5 });
  // Behind a cosine of 0.6, the different pair scoring 0.95 (cosine 0.5) is never a candidate.
  assert.deepEqual(rerankRow(scored, 0.5, 0.6), { threshold: 0.5, reused: 0.5, falseHits: 0 });
});

test('thresholdForFalseHits: lowest threshold that meets the target, or null', () => {
  const rows = [0.9, 0.3, 0.6].map((t) => rerankRow(scored, t));
  assert.equal(thresholdForFalseHits(rows, 0.5)?.threshold, 0.3);
  assert.equal(thresholdForFalseHits(rows, 0), null);
  assert.equal(thresholdForFalseHits([rerankRow(scored, 0.1)], 0), null);
});

test('findDigest: exact tag, implicit :latest, and a missing model', () => {
  const models = [
    { name: 'qwen2.5:3b', digest: 'sha256:aaa' },
    { name: 'nomic-embed-text:latest', model: 'nomic-embed-text:latest', digest: 'sha256:bbb' },
  ];
  assert.equal(findDigest(models, 'qwen2.5:3b'), 'sha256:aaa');
  assert.equal(findDigest(models, 'nomic-embed-text'), 'sha256:bbb');
  assert.throws(() => findDigest(models, 'qwen2.5:7b'), /ollama pull qwen2.5:7b/);
  assert.equal(shortDigest('sha256:0123456789abcdef'), '0123456789ab');
});
