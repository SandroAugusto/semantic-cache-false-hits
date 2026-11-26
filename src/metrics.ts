import {
  HARD_NEGATIVE_CATEGORIES,
  type Category,
  type CategoryStats,
  type ScoredPair,
  type ThresholdRow,
} from './types.ts';

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error(`Vectors have different dimensions: ${a.length} and ${b.length}`);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) throw new Error('Zero vector: similarity is undefined');
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const fraction = (part: number, total: number) => (total === 0 ? 0 : part / total);

/**
 * Scores any cache policy: `isHit` decides, for each pair, whether the cache would
 * serve the stored answer to the new question.
 */
export function evaluatePolicy(
  pairs: ScoredPair[],
  isHit: (pair: ScoredPair) => boolean,
  threshold = Number.NaN,
): ThresholdRow {
  const same = pairs.filter((p) => p.label === 'same');
  const different = pairs.filter((p) => p.label === 'different');
  const hardNegatives = different.filter((p) => HARD_NEGATIVE_CATEGORIES.includes(p.category));

  const sameHits = same.filter(isHit).length;
  const falseHits = different.filter(isHit).length;

  const falseHitRateByCategory: Record<string, number> = {};
  for (const category of new Set(different.map((p) => p.category))) {
    const ofCategory = different.filter((p) => p.category === category);
    falseHitRateByCategory[category] = fraction(ofCategory.filter(isHit).length, ofCategory.length);
  }

  return {
    threshold,
    hitRate: fraction(sameHits, same.length),
    falseHitRate: fraction(falseHits, different.length),
    hardNegativeFalseHitRate: fraction(hardNegatives.filter(isHit).length, hardNegatives.length),
    precision: sameHits + falseHits === 0 ? 1 : sameHits / (sameHits + falseHits),
    falseHitRateByCategory,
  };
}

/** A pair is a cache hit when its similarity reaches the threshold. */
export function evaluateThreshold(pairs: ScoredPair[], threshold: number): ThresholdRow {
  return evaluatePolicy(pairs, (p) => p.similarity >= threshold, threshold);
}

export function sweepThresholds(pairs: ScoredPair[], from = 0.5, to = 0.99, step = 0.01): ThresholdRow[] {
  const rows: ThresholdRow[] = [];
  // Integer steps avoid accumulated floating-point error (0.1 + 0.2 ...).
  const scale = Math.round(1 / step);
  for (let i = Math.round(from * scale); i <= Math.round(to * scale); i++) {
    rows.push(evaluateThreshold(pairs, i / scale));
  }
  return rows;
}

export interface SafeThreshold {
  /** null when a hard negative has similarity 1: no threshold can separate it. */
  threshold: number | null;
  hitRate: number;
}

/**
 * Lowest threshold at which no hard negative becomes a hit.
 * It is the "safe" point (within this dataset) and shows how much savings are left there.
 */
export function safeThreshold(pairs: ScoredPair[]): SafeThreshold | null {
  const hardNegatives = pairs.filter((p) => HARD_NEGATIVE_CATEGORIES.includes(p.category));
  if (hardNegatives.length === 0) return null;
  const worst = Math.max(...hardNegatives.map((p) => p.similarity));
  // A hit is ">=", so the safe threshold sits just above the worst hard negative.
  const threshold = Math.ceil((worst + 1e-9) * 1000) / 1000;
  // Above 1 nothing passes: no threshold separates the cases.
  if (threshold > 1) return { threshold: null, hitRate: 0 };
  return { threshold, hitRate: evaluateThreshold(pairs, threshold).hitRate };
}

export function statsByCategory(pairs: ScoredPair[]): CategoryStats[] {
  const categories = [...new Set(pairs.map((p) => p.category))] as Category[];
  return categories.map((category) => {
    const values = pairs.filter((p) => p.category === category).map((p) => p.similarity);
    return {
      category,
      count: values.length,
      min: Math.min(...values),
      mean: values.reduce((sum, v) => sum + v, 0) / values.length,
      max: Math.max(...values),
    };
  });
}

/** Nearest-rank percentile, p in [0, 100]. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((x, y) => x - y);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}
