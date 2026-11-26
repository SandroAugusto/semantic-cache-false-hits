# Track A: real patient questions against a whole cache

Data: [Medical Question Pairs](https://github.com/curai/medical-question-pair-dataset) (McCreery et al., KDD 2020): 1524 real patient questions, each with a doctor-written **rewrite** (same intent) and a **related** question written with similar keywords whose answer would be wrong. The dataset is downloaded at run time and not stored here, so this report shows aggregates only.

Embeddings: nomic-embed-text | prefix: none. Judge: qwen2.5:7b (health).

## Part 1: pairs

- Mean similarity, original vs. rewrite: **0.858**
- Mean similarity, original vs. related question: **0.708**
- Pairs where the related question is closer than the rewrite: **4.7%**
- Safe threshold (no related question accepted): **0.977**, reusing **1.0%** of rewrites
- Threshold that accepts only 1% of related questions: **0.907**, reusing **29.5%** of rewrites

| Threshold | Rewrites reused | Related questions accepted |
|---:|---:|---:|
| 0.60 | 99.9% | 87.8% |
| 0.65 | 98.8% | 72.8% |
| 0.70 | 96.3% | 54.0% |
| 0.75 | 90.8% | 34.4% |
| 0.80 | 79.2% | 16.7% |
| 0.85 | 61.0% | 5.7% |
| 0.90 | 33.0% | 1.2% |
| 0.95 | 8.1% | 0.1% |

## Part 2: whole cache

All 1524 originals are stored. 220 queries (110 rewrites and 110 related questions, sampled with seed 42) each search the entire cache for their top 1 neighbors. The rewrite's own original is the nearest neighbor in **95.5%** of cases.

| Policy | Threshold | Rewrites: right answer | Rewrites: wrong answer | Rewrites: miss | Related: wrong answer | Judge calls per query |
|---|---:|---:|---:|---:|---:|---:|
| threshold only (top-1) | 0.55 | 95.5% | 4.5% | 0.0% | 100.0% | - |
| threshold only (top-1) | 0.60 | 95.5% | 4.5% | 0.0% | 100.0% | - |
| threshold only (top-1) | 0.65 | 95.5% | 4.5% | 0.0% | 93.6% | - |
| threshold only (top-1) | 0.70 | 95.5% | 4.5% | 0.0% | 77.3% | - |
| threshold only (top-1) | 0.75 | 90.9% | 2.7% | 6.4% | 40.0% | - |
| threshold only (top-1) | 0.80 | 74.5% | 1.8% | 23.6% | 13.6% | - |
| threshold only (top-1) | 0.85 | 50.9% | 0.0% | 49.1% | 3.6% | - |
| threshold only (top-1) | 0.90 | 22.7% | 0.0% | 77.3% | 1.8% | - |
| threshold + judge (top-1) | 0.60 | 85.5% | 1.8% | 12.7% | 13.6% | 1.00 |
| threshold + judge (top-1) | 0.60 | 85.5% | 1.8% | 12.7% | 13.6% | 1.00 |
| threshold + judge (top-1) | 0.70 | 85.5% | 1.8% | 12.7% | 13.6% | 0.89 |
| threshold + judge (top-1) | 0.70 | 85.5% | 1.8% | 12.7% | 13.6% | 0.89 |

## Wrong answers per 1,000 queries, by traffic mix

Real traffic mixes rewrites of cached questions with related-but-different ones. Nobody knows that mix without production data, so the table varies it. Both columns count only queries that have a close question in the cache; brand-new questions would mostly miss and are left out.

| Policy | Threshold | 0% related: wrong / saved | 10% related: wrong / saved | 25% related: wrong / saved | 50% related: wrong / saved |
|---|---:|---:|---:|---:|---:|
| threshold only (top-1) | 0.60 | 45 / 955 | 141 / 859 | 284 / 716 | 523 / 477 |
| threshold only (top-1) | 0.70 | 45 / 955 | 118 / 859 | 227 / 716 | 409 / 477 |
| threshold only (top-1) | 0.80 | 18 / 745 | 30 / 671 | 48 / 559 | 77 / 373 |
| threshold only (top-1) | 0.85 | 0 / 509 | 4 / 458 | 9 / 382 | 18 / 255 |
| threshold + judge (top-1) | 0.60 | 18 / 855 | 30 / 769 | 48 / 641 | 77 / 427 |
| threshold + judge (top-1) | 0.60 | 18 / 855 | 30 / 769 | 48 / 641 | 77 / 427 |
| threshold + judge (top-1) | 0.70 | 18 / 855 | 30 / 769 | 48 / 641 | 77 / 427 |
| threshold + judge (top-1) | 0.70 | 18 / 855 | 30 / 769 | 48 / 641 | 77 / 427 |

## Judge cost

220 judge calls, 0 invalid replies. Latency on this runner: mean 8589 ms, p95 12670 ms.

## Caveats

- The related questions were written on purpose to share keywords with the original: they are realistic in wording, not in frequency.
- Rewrites may change details the doctor judged irrelevant (for example, an age). A strict judge can call those "different", which lowers savings but not safety.
- 110 sampled queries per kind: at 0.9% per query, small rates are noisy.
- The time budget stopped judging after 110 of the 150 planned pairs; rerunning the workflow resumes from the cached verdicts.
