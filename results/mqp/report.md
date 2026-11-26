# Track A: real patient questions against a whole cache

Data: [Medical Question Pairs](https://github.com/curai/medical-question-pair-dataset) (McCreery et al., KDD 2020): 1524 real patient questions, each with a doctor-written **rewrite** (same intent) and a **related** question written with similar keywords whose answer would be wrong. The dataset is downloaded at run time and not stored here, so this report shows aggregates only.

Embeddings: nomic-embed-text | prefix: none. Judge: qwen2.5:3b (health).

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

All 1524 originals are stored. 300 queries (150 rewrites and 150 related questions, sampled with seed 42) each search the entire cache for their top 3 neighbors. The rewrite's own original is the nearest neighbor in **96.7%** of cases.

| Policy | Threshold | Rewrites: right answer | Rewrites: wrong answer | Rewrites: miss | Related: wrong answer | Judge calls per query |
|---|---:|---:|---:|---:|---:|---:|
| threshold only (top-1) | 0.55 | 96.7% | 3.3% | 0.0% | 100.0% | - |
| threshold only (top-1) | 0.60 | 96.7% | 3.3% | 0.0% | 100.0% | - |
| threshold only (top-1) | 0.65 | 96.7% | 3.3% | 0.0% | 93.3% | - |
| threshold only (top-1) | 0.70 | 96.0% | 3.3% | 0.7% | 77.3% | - |
| threshold only (top-1) | 0.75 | 92.0% | 2.0% | 6.0% | 42.0% | - |
| threshold only (top-1) | 0.80 | 77.3% | 1.3% | 21.3% | 16.0% | - |
| threshold only (top-1) | 0.85 | 54.0% | 0.0% | 46.0% | 5.3% | - |
| threshold only (top-1) | 0.90 | 24.7% | 0.0% | 75.3% | 2.7% | - |
| threshold + judge (top-1) | 0.60 | 64.0% | 0.0% | 36.0% | 7.3% | 1.00 |
| threshold + judge (top-3) | 0.60 | 64.0% | 0.0% | 36.0% | 8.0% | 2.23 |
| threshold + judge (top-1) | 0.70 | 63.3% | 0.0% | 36.7% | 7.3% | 0.88 |
| threshold + judge (top-3) | 0.70 | 63.3% | 0.0% | 36.7% | 8.0% | 1.25 |

## Wrong answers per 1,000 queries, by traffic mix

Real traffic mixes rewrites of cached questions with related-but-different ones. Nobody knows that mix without production data, so the table varies it. Both columns count only queries that have a close question in the cache; brand-new questions would mostly miss and are left out.

| Policy | Threshold | 0% related: wrong / saved | 10% related: wrong / saved | 25% related: wrong / saved | 50% related: wrong / saved |
|---|---:|---:|---:|---:|---:|
| threshold only (top-1) | 0.60 | 33 / 967 | 130 / 870 | 275 / 725 | 517 / 483 |
| threshold only (top-1) | 0.70 | 33 / 960 | 107 / 864 | 218 / 720 | 403 / 480 |
| threshold only (top-1) | 0.80 | 13 / 773 | 28 / 696 | 50 / 580 | 87 / 387 |
| threshold only (top-1) | 0.85 | 0 / 540 | 5 / 486 | 13 / 405 | 27 / 270 |
| threshold + judge (top-1) | 0.60 | 0 / 640 | 7 / 576 | 18 / 480 | 37 / 320 |
| threshold + judge (top-3) | 0.60 | 0 / 640 | 8 / 576 | 20 / 480 | 40 / 320 |
| threshold + judge (top-1) | 0.70 | 0 / 633 | 7 / 570 | 18 / 475 | 37 / 317 |
| threshold + judge (top-3) | 0.70 | 0 / 633 | 8 / 570 | 20 / 475 | 40 / 317 |

## Judge cost

876 judge calls, 0 invalid replies. Latency on this runner: mean 2251 ms, p95 3806 ms.

## Caveats

- The related questions were written on purpose to share keywords with the original: they are realistic in wording, not in frequency.
- Rewrites may change details the doctor judged irrelevant (for example, an age). A strict judge can call those "different", which lowers savings but not safety.
- 150 sampled queries per kind: at 0.7% per query, small rates are noisy.
