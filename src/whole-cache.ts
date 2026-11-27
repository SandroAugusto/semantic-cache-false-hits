/**
 * Whole-cache simulation for Track A, kept free of I/O so it can be tested directly.
 *
 * MQP labels only three relations per item: original vs. its rewrite (same), and original vs.
 * its related question (different). When a query is served a *different* original, the dataset
 * says nothing about whether that answer would be right. Those hits are counted separately as
 * "other original" instead of being silently folded into right or wrong.
 */

export type QueryKind = 'rewrite' | 'related';

export interface Neighbor {
  id: number;
  similarity: number;
}

export interface CacheQuery {
  /** The MQP item the query was written from: its own original has this id. */
  itemId: number;
  kind: QueryKind;
  /** Nearest cached originals, sorted by similarity, highest first. */
  top: Neighbor[];
}

export interface CachePolicy {
  threshold: number;
  /** How many neighbors to consider, best first (1 = top-1). */
  depth: number;
  /** Omit for threshold-only. Otherwise returns the judge's verdict for (query, cached original). */
  judge?: (query: CacheQuery, candidateId: number) => boolean;
}

export interface CacheCounts {
  rewrites: number;
  related: number;
  /** Rewrite served its own original: labeled correct by MQP. */
  rewriteOwn: number;
  /** Rewrite served another original: not labeled by MQP. */
  rewriteOther: number;
  rewriteMiss: number;
  /** Related question served its own original: labeled wrong by MQP. */
  relatedOwn: number;
  /** Related question served another original: not labeled by MQP. */
  relatedOther: number;
  relatedMiss: number;
  judgeCalls: number;
}

export interface ServedHit {
  kind: QueryKind;
  itemId: number;
  servedId: number;
  similarity: number;
}

export interface SimulationResult {
  counts: CacheCounts;
  /** Every hit on an original other than the query's own: the set that needs labels. */
  otherHits: ServedHit[];
}

export function simulateCache(queries: CacheQuery[], policy: CachePolicy): SimulationResult {
  const { threshold, depth, judge } = policy;
  if (!Number.isFinite(threshold) || threshold < -1 || threshold > 1) {
    throw new Error(`Threshold must be a number in [-1, 1], got ${threshold}`);
  }
  if (!Number.isInteger(depth) || depth < 1) throw new Error(`Depth must be a positive integer, got ${depth}`);

  const counts: CacheCounts = {
    rewrites: 0,
    related: 0,
    rewriteOwn: 0,
    rewriteOther: 0,
    rewriteMiss: 0,
    relatedOwn: 0,
    relatedOther: 0,
    relatedMiss: 0,
    judgeCalls: 0,
  };
  const otherHits: ServedHit[] = [];

  for (const q of queries) {
    for (let i = 1; i < q.top.length; i++) {
      if (q.top[i].similarity > q.top[i - 1].similarity) {
        throw new Error(`Neighbors of ${q.kind} ${q.itemId} are not sorted by similarity`);
      }
    }

    let served: Neighbor | null = null;
    for (const c of q.top.slice(0, depth)) {
      if (c.similarity < threshold) break; // Sorted: nothing further down passes either.
      if (!judge) {
        served = c;
        break;
      }
      counts.judgeCalls++;
      if (judge(q, c.id)) {
        served = c;
        break;
      }
    }

    const own = served !== null && served.id === q.itemId;
    if (q.kind === 'rewrite') {
      counts.rewrites++;
      if (served === null) counts.rewriteMiss++;
      else if (own) counts.rewriteOwn++;
      else counts.rewriteOther++;
    } else {
      counts.related++;
      if (served === null) counts.relatedMiss++;
      else if (own) counts.relatedOwn++;
      else counts.relatedOther++;
    }
    if (served !== null && !own) {
      otherHits.push({ kind: q.kind, itemId: q.itemId, servedId: served.id, similarity: served.similarity });
    }
  }

  return { counts, otherHits };
}

export interface LegacyRates {
  rewriteCorrect: number;
  rewriteWrong: number;
  rewriteMiss: number;
  relatedWrong: number;
  judgeCallsPerQuery: number;
}

/**
 * The rates published before unlabeled hits were split out: every hit on another original counts
 * as wrong. Kept so earlier reports stay comparable; read them as an upper bound on wrong answers.
 */
export function legacyRates(c: CacheCounts): LegacyRates {
  if (c.rewrites === 0 || c.related === 0) throw new Error('Need at least one rewrite and one related query');
  const queries = c.rewrites + c.related;
  return {
    rewriteCorrect: c.rewriteOwn / c.rewrites,
    rewriteWrong: c.rewriteOther / c.rewrites,
    rewriteMiss: c.rewriteMiss / c.rewrites,
    relatedWrong: (c.relatedOwn + c.relatedOther) / c.related,
    judgeCallsPerQuery: c.judgeCalls / queries,
  };
}
