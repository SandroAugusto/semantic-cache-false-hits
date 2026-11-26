export type Label = 'same' | 'different';

export type Category =
  | 'paraphrase'
  | 'antonym'
  | 'negation'
  | 'entity'
  | 'number'
  | 'scope'
  | 'direction'
  | 'unrelated';

export const CATEGORIES: readonly Category[] = [
  'paraphrase',
  'antonym',
  'negation',
  'entity',
  'number',
  'scope',
  'direction',
  'unrelated',
];

/** Same topic, different meaning: the pairs a semantic cache is most likely to confuse. */
export const HARD_NEGATIVE_CATEGORIES: readonly Category[] = [
  'antonym',
  'negation',
  'entity',
  'number',
  'scope',
  'direction',
];

export interface Pair {
  id: string;
  category: Category;
  label: Label;
  a: string;
  b: string;
}

export interface ScoredPair extends Pair {
  similarity: number;
}

export interface ThresholdRow {
  threshold: number;
  /** Share of paraphrases the cache would reuse (higher means more savings). */
  hitRate: number;
  /** Share of "different" pairs that become false hits. */
  falseHitRate: number;
  /** Share of hard negatives (same topic, different meaning) that become false hits. */
  hardNegativeFalseHitRate: number;
  /** Of everything the cache would return, how much is correct. */
  precision: number;
  falseHitRateByCategory: Record<string, number>;
}

export interface CategoryStats {
  category: Category;
  count: number;
  min: number;
  mean: number;
  max: number;
}
