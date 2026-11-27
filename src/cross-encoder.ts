/**
 * Pure helpers for the cross-encoder baseline (src/rerank.ts). Kept apart from the model
 * code so they can be tested without downloading a model.
 */

/**
 * Turns a cross-encoder's logits into the probability that two questions are duplicates.
 * One logit per pair (a binary cross-encoder such as the Quora ones): sigmoid. Two logits
 * (a "not duplicate" / "duplicate" classifier): softmax, second class.
 */
export function duplicateProbabilities(data: ArrayLike<number>, dims: readonly number[]): number[] {
  const [rows, labels] = dims;
  if (dims.length !== 2 || rows === undefined || labels === undefined || data.length !== rows * labels) {
    throw new Error(`Expected logits of shape [pairs, 1 or 2], got [${dims.join(', ')}] with ${data.length} values`);
  }
  const out: number[] = [];
  for (let i = 0; i < rows; i++) {
    if (labels === 1) {
      out.push(1 / (1 + Math.exp(-data[i])));
    } else if (labels === 2) {
      const [no, yes] = [data[2 * i], data[2 * i + 1]];
      const top = Math.max(no, yes);
      out.push(Math.exp(yes - top) / (Math.exp(no - top) + Math.exp(yes - top)));
    } else {
      throw new Error(`Expected 1 or 2 logits per pair, got ${labels}`);
    }
  }
  return out;
}

export interface PairScore {
  /** True when the cache should reuse the answer (paraphrase / doctor's rewrite). */
  same: boolean;
  /** Duplicate probability from the cross-encoder. */
  score: number;
  /** Cosine similarity of the two questions' embeddings, when known. */
  similarity?: number;
}

export interface RerankRow {
  threshold: number;
  /** Share of "same" pairs accepted. */
  reused: number;
  /** Share of "different" pairs accepted. */
  falseHits: number;
}

/** Accepts a pair when its score reaches `threshold` and, if `minSimilarity` is set, its cosine reaches that. */
export function rerankRow(pairs: readonly PairScore[], threshold: number, minSimilarity?: number): RerankRow {
  const accepted = (p: PairScore) =>
    p.score >= threshold && (minSimilarity === undefined || (p.similarity ?? -Infinity) >= minSimilarity);
  const same = pairs.filter((p) => p.same);
  const different = pairs.filter((p) => !p.same);
  const share = (xs: readonly PairScore[]) => (xs.length === 0 ? 0 : xs.filter(accepted).length / xs.length);
  return { threshold, reused: share(same), falseHits: share(different) };
}

/**
 * The lowest threshold on the grid whose false-hit share is at most `maxFalseHits`, with its
 * reuse; null when no threshold on the grid gets there.
 */
export function thresholdForFalseHits(rows: readonly RerankRow[], maxFalseHits: number): RerankRow | null {
  return [...rows].sort((a, b) => a.threshold - b.threshold).find((r) => r.falseHits <= maxFalseHits) ?? null;
}
