import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type CacheCounts, type CacheQuery, legacyRates, simulateCache } from '../src/whole-cache.ts';

const q = (kind: CacheQuery['kind'], itemId: number, ...top: [number, number][]): CacheQuery => ({
  kind,
  itemId,
  top: top.map(([id, similarity]) => ({ id, similarity })),
});

const judgeFrom = (accepted: string[]) => (query: CacheQuery, id: number) =>
  accepted.includes(`${query.kind}:${query.itemId}:${id}`);

function assertInvariants(c: CacheCounts) {
  assert.equal(c.rewriteOwn + c.rewriteOther + c.rewriteMiss, c.rewrites);
  assert.equal(c.relatedOwn + c.relatedOther + c.relatedMiss, c.related);
}

test('threshold only: own original, other original and miss are counted apart', () => {
  const queries = [
    q('rewrite', 1, [1, 0.9], [2, 0.8]), // own original
    q('rewrite', 2, [5, 0.85], [2, 0.84]), // another original wins
    q('rewrite', 3, [3, 0.7]), // below threshold
    q('related', 1, [1, 0.88]), // own original: labeled wrong
    q('related', 2, [7, 0.81]), // another original: unlabeled
    q('related', 3, [3, 0.5]), // miss
  ];
  const { counts, otherHits } = simulateCache(queries, { threshold: 0.8, depth: 1 });
  assert.deepEqual(counts, {
    rewrites: 3, related: 3,
    rewriteOwn: 1, rewriteOther: 1, rewriteMiss: 1,
    relatedOwn: 1, relatedOther: 1, relatedMiss: 1,
    judgeCalls: 0,
  });
  assert.deepEqual(otherHits, [
    { kind: 'rewrite', itemId: 2, servedId: 5, similarity: 0.85 },
    { kind: 'related', itemId: 2, servedId: 7, similarity: 0.81 },
  ]);
  assertInvariants(counts);
});

test('threshold is inclusive: similarity equal to the threshold is a hit', () => {
  const { counts } = simulateCache([q('rewrite', 1, [1, 0.8]), q('related', 1, [1, 0.7999999])], {
    threshold: 0.8,
    depth: 1,
  });
  assert.equal(counts.rewriteOwn, 1);
  assert.equal(counts.relatedMiss, 1);
});

test('judge top-k: a rejection is followed by acceptance of the next neighbor', () => {
  const queries = [q('rewrite', 1, [4, 0.9], [1, 0.85], [6, 0.8]), q('related', 1, [1, 0.9])];
  const { counts, otherHits } = simulateCache(queries, { threshold: 0.6, depth: 3, judge: judgeFrom(['rewrite:1:1']) });
  assert.equal(counts.rewriteOwn, 1); // neighbor 4 rejected, own original accepted
  assert.equal(counts.relatedMiss, 1);
  assert.equal(counts.judgeCalls, 3); // 2 for the rewrite, 1 for the related query
  assert.deepEqual(otherHits, []);
});

test('judge top-k: can accept another original after rejecting the own one', () => {
  const queries = [q('rewrite', 1, [1, 0.9], [3, 0.88]), q('related', 1, [8, 0.7])];
  const { counts, otherHits } = simulateCache(queries, {
    threshold: 0.6,
    depth: 2,
    judge: judgeFrom(['rewrite:1:3']),
  });
  assert.equal(counts.rewriteOther, 1);
  assert.deepEqual(otherHits, [{ kind: 'rewrite', itemId: 1, servedId: 3, similarity: 0.88 }]);
});

test('judge: neighbors below the threshold are never sent to the judge', () => {
  const calls: number[] = [];
  const queries = [q('rewrite', 1, [2, 0.65], [1, 0.55]), q('related', 1, [3, 0.4])];
  simulateCache(queries, { threshold: 0.6, depth: 3, judge: (_, id) => (calls.push(id), false) });
  assert.deepEqual(calls, [2]);
});

test('depth limits the neighbors considered', () => {
  const queries = [q('rewrite', 1, [2, 0.9], [1, 0.85]), q('related', 1, [1, 0.5])];
  const top1 = simulateCache(queries, { threshold: 0.6, depth: 1, judge: judgeFrom(['rewrite:1:1']) }).counts;
  const top2 = simulateCache(queries, { threshold: 0.6, depth: 2, judge: judgeFrom(['rewrite:1:1']) }).counts;
  assert.equal(top1.rewriteMiss, 1);
  assert.equal(top2.rewriteOwn, 1);
});

test('rejects invalid policies and unsorted neighbors', () => {
  const queries = [q('rewrite', 1, [1, 0.9])];
  for (const threshold of [Number.NaN, 1.5, -2]) {
    assert.throws(() => simulateCache(queries, { threshold, depth: 1 }), /Threshold/);
  }
  for (const depth of [0, 1.5, -1]) {
    assert.throws(() => simulateCache(queries, { threshold: 0.5, depth }), /Depth/);
  }
  assert.throws(
    () => simulateCache([q('rewrite', 1, [1, 0.5], [2, 0.9])], { threshold: 0.5, depth: 2 }),
    /not sorted/,
  );
});

test('legacy rates: other-original hits count as wrong, as in published reports', () => {
  const counts: CacheCounts = {
    rewrites: 4, related: 4,
    rewriteOwn: 2, rewriteOther: 1, rewriteMiss: 1,
    relatedOwn: 1, relatedOther: 1, relatedMiss: 2,
    judgeCalls: 6,
  };
  assert.deepEqual(legacyRates(counts), {
    rewriteCorrect: 0.5,
    rewriteWrong: 0.25,
    rewriteMiss: 0.25,
    relatedWrong: 0.5,
    judgeCallsPerQuery: 0.75,
  });
  assert.throws(() => legacyRates({ ...counts, rewrites: 0 }));
});

test('invariants hold on random inputs', () => {
  let state = 7;
  const random = () => ((state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const queries: CacheQuery[] = [];
  for (let item = 0; item < 200; item++) {
    for (const kind of ['rewrite', 'related'] as const) {
      const top = Array.from({ length: 3 }, () => ({ id: Math.floor(random() * 20), similarity: random() }))
        .sort((a, b) => b.similarity - a.similarity);
      queries.push({ kind, itemId: item % 20, top });
    }
  }
  for (const depth of [1, 2, 3]) {
    for (const threshold of [0, 0.3, 0.6, 0.9]) {
      const { counts, otherHits } = simulateCache(queries, { threshold, depth, judge: () => random() < 0.5 });
      assertInvariants(counts);
      assert.equal(otherHits.length, counts.rewriteOther + counts.relatedOther);
      assert.ok(counts.judgeCalls <= queries.length * depth);
    }
  }
});
