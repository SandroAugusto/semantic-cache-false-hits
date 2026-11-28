# Cross-encoder baseline

Model: `cross-encoder/quora-distilroberta-base` at revision `main`, through Transformers.js on CPU (fp32). Score: the model's duplicate probability. A pair is accepted when the score reaches the threshold.

## Part 1: the 56 hand-written pairs

"Paraphrases reused" against "hard negatives accepted" (the six same-topic categories), for the cross-encoder alone and behind a cosine threshold of 0.6 (similarities from `results/nomic-embed-text__no-prefix/pairs.csv`), the setting of Experiment 2.

| Threshold | Reused (alone) | Hard negatives accepted (alone) | Reused (cosine + cross-encoder) | Hard negatives accepted (cosine + cross-encoder) |
|---:|---:|---:|---:|---:|
| 0.05 | 38.9% | 20.0% | 38.9% | 20.0% |
| 0.10 | 27.8% | 13.3% | 27.8% | 13.3% |
| 0.15 | 22.2% | 10.0% | 22.2% | 10.0% |
| 0.20 | 22.2% | 10.0% | 22.2% | 10.0% |
| 0.25 | 16.7% | 10.0% | 16.7% | 10.0% |
| 0.30 | 16.7% | 10.0% | 16.7% | 10.0% |
| 0.35 | 16.7% | 10.0% | 16.7% | 10.0% |
| 0.40 | 16.7% | 10.0% | 16.7% | 10.0% |
| 0.45 | 16.7% | 10.0% | 16.7% | 10.0% |
| 0.50 | 16.7% | 10.0% | 16.7% | 10.0% |
| 0.55 | 16.7% | 10.0% | 16.7% | 10.0% |
| 0.60 | 16.7% | 10.0% | 16.7% | 10.0% |
| 0.65 | 16.7% | 6.7% | 16.7% | 6.7% |
| 0.70 | 11.1% | 6.7% | 11.1% | 6.7% |
| 0.75 | 11.1% | 6.7% | 11.1% | 6.7% |
| 0.80 | 5.6% | 3.3% | 5.6% | 3.3% |
| 0.85 | 5.6% | 3.3% | 5.6% | 3.3% |
| 0.90 | 5.6% | 3.3% | 5.6% | 3.3% |
| 0.95 | 5.6% | 3.3% | 5.6% | 3.3% |

Highest-scoring pairs that should not be reused:

| Id | Category | Score |
|---|---|---:|
| h29 | direction | 0.975 |
| h30 | direction | 0.784 |
| h02 | antonym | 0.609 |
| h28 | direction | 0.114 |
| h03 | antonym | 0.057 |

## Part 2: Medical Question Pairs, pair level

1524 real patient questions, each scored against its doctor-written rewrite (should be reused) and its related question (should not). Compare with Track A, Part 1, where the cosine threshold that accepts at most 1% of related questions reuses 29.5% of rewrites (results/mqp/report.md).

| Threshold | Rewrites reused | Related questions accepted |
|---:|---:|---:|
| 0.05 | 61.0% | 10.2% |
| 0.10 | 57.3% | 7.9% |
| 0.15 | 55.6% | 7.1% |
| 0.20 | 54.1% | 6.8% |
| 0.25 | 53.0% | 6.6% |
| 0.30 | 52.3% | 6.4% |
| 0.35 | 51.7% | 6.3% |
| 0.40 | 51.2% | 6.3% |
| 0.45 | 50.8% | 6.2% |
| 0.50 | 49.9% | 5.7% |
| 0.55 | 49.1% | 5.6% |
| 0.60 | 48.5% | 5.2% |
| 0.65 | 47.6% | 5.0% |
| 0.70 | 47.0% | 4.9% |
| 0.75 | 46.0% | 4.5% |
| 0.80 | 45.0% | 3.9% |
| 0.85 | 43.5% | 3.7% |
| 0.90 | 39.4% | 3.3% |
| 0.95 | 31.6% | 2.2% |

- At most 5.0% of related questions accepted: threshold 0.65, 47.6% of rewrites reused (5.0% related accepted).
- No threshold on the grid keeps related questions at or below 1.0%.

## Cost

3104 pairs scored in batches of 16. Per pair: mean 45.9 ms, p95 of batch averages 64.8 ms, on this machine's CPU. Batch averages understate the latency of a single query scored alone.

## Limits

- The model was trained on Quora question pairs, not medical or clinical-trial questions.
- Part 1 has 5 pairs per hard-negative category; each pair is 20 percentage points of its category.
- Part 2 is pair level only: each query against its own original, not against the whole cache.
