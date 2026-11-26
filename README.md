# Semantic cache false hits: when "similar" is not "the same"

A semantic cache reuses the answer to a previous question when a new question is similar enough, measured by the cosine similarity between their embeddings. The upside is real: no model call at all. So is the risk: confidently returning the answer to a **different** question.

This experiment measures that risk. The hypothesis is that questions on the **same topic with a different meaning**, such as "inclusion criteria" and "exclusion criteria", sit as close together in embedding space as true paraphrases do. If that holds, no similarity threshold can safely tell them apart.

## What is measured

The dataset (`data/pairs.jsonl`) has 56 question pairs in the clinical trials domain:

| Category | Pairs | What changes between the two questions | Should the cache reuse the answer? |
|---|---:|---|---|
| `paraphrase` | 18 | Only the wording | Yes |
| `antonym` | 5 | One word swapped for its opposite (inclusion/exclusion, minimum/maximum) | No |
| `negation` | 5 | A "not" (can/can not) | No |
| `entity` | 5 | The subject (FDA/EMA, treatment group/placebo group) | No |
| `number` | 5 | A number (week 4/week 12, 10 mg/50 mg) | No |
| `scope` | 5 | The reach (common/serious side effects, participant/fetus) | No |
| `direction` | 5 | Who acts on whom (sponsor pays participant/participant pays sponsor) | No |
| `unrelated` | 8 | Everything | No |

The six middle categories are the **hard negatives**: the dangerous case.

For every threshold from 0.50 to 0.99, the report shows:

- **Paraphrases reused:** how much the cache saves.
- **Hard negatives accepted:** how often the cache would return a wrong answer.
- **Precision:** of everything the cache returns, how much is correct.
- **Safe threshold:** the lowest threshold at which no hard negative gets through, and how much savings are left there.

## Running it

Requirements: Node.js 22.18 or newer (runs TypeScript directly, no build step) and [Ollama](https://ollama.com).

```bash
ollama pull nomic-embed-text
npm install        # dev dependencies only (typescript, @types/node)
npm run all        # runs with no prefix, then with "search_query: " and "clustering: "
```

For a single configuration:

```bash
npm start -- --model nomic-embed-text --prefix none --reference 0.75
```

| Option | Default | Purpose |
|---|---|---|
| `--model` | `nomic-embed-text` | Any Ollama embedding model |
| `--prefix` | `none` | Task prefix; `nomic-embed-text` was trained with prefixes such as `search_query: ` |
| `--reference` | `0.75` | Threshold highlighted in the report |
| `--host` | `http://localhost:11434` | Ollama address (or the `OLLAMA_HOST` env var) |
| `--data` | `data/pairs.jsonl` | A different pair set |
| `--out` | `results` | Output folder |

Each configuration writes to `results/<model>__<prefix>/`:

- `report.md`: the summary, including the most dangerous hard negatives and the hardest paraphrases;
- `sweep.csv`: the full threshold sweep, ready to chart;
- `pairs.csv`: the similarity of every pair.

Embeddings are cached in `results/.embeddings-cache.json`, so reruns never call the model for texts it has already seen.

Experiment 2 and the chart:

```bash
ollama pull qwen2.5:3b && ollama pull llama3.2:3b && ollama pull qwen2.5:7b
npm run verify     # threshold + LLM judge, writes results/verification/
npm run chart      # writes results/tradeoff.svg
```

`npm run verify` accepts `--judges`, `--prompts` (`plain`, `guided`), `--thresholds` and `--prefix`.

The workflow in `.github/workflows/run-experiment.yml` runs everything on GitHub Actions and commits the results whenever the data or the code changes.

```bash
npm test           # metric tests
npm run typecheck  # type checking
```

## Reading the results

- If the similarity range of hard negatives **overlaps** with that of paraphrases, no threshold fixes it: raising the threshold cuts savings before it cuts errors.
- The **safe threshold** is the price of safety: if the cache reuses only 20% of paraphrases there, a plain semantic cache barely pays off in this domain.
- Compare categories. The expectation, to be confirmed by the data, is that negation and number changes are the worst: embedding models tend to capture the topic better than the details that change the answer.

## Limitations

- **Small, hand-written dataset:** 5 pairs per hard-negative category, so each pair is worth 20 percentage points. It shows the phenomenon; it does not estimate a precise rate.
- **Labels are human judgment:** some paraphrase pairs are debatable.
- **One domain, one language:** short English questions about clinical trials. Other domains, languages and models may behave differently.
- **Isolated pairs:** a real cache compares a new question against every stored question, and the nearest neighbor may be a hard negative even when the pair tested here is not.

## Results

All runs below come from the GitHub Actions workflow in this repository (`ubuntu-latest`, CPU only, Ollama). Raw outputs are in [`results/`](results/).

### Experiment 1: threshold only

Hard negatives turned out to be **more** similar than real paraphrases. With no prefix, paraphrases average 0.737 cosine similarity, while every hard-negative category averages between 0.81 and 0.97. Raising the threshold removes paraphrases before it removes wrong answers:

| Embedding config | Paraphrases reused at 0.75 | Hard negatives accepted at 0.75 | Safe threshold | Paraphrases reused at the safe threshold |
|---|---:|---:|---:|---:|
| no prefix | 56% | 100% | 0.994 | 0% |
| `search_query: ` | 67% | 100% | 0.996 | 0% |
| `clustering: ` | 94% | 100% | 0.998 | 0% |

The worst offenders are role swaps ("Does the sponsor pay the participant?" vs. "Does the participant pay the sponsor?" scores 0.993) and negations. No threshold separates them from paraphrases, so this is not a calibration problem.

### Experiment 2: threshold + LLM judge

The threshold only proposes a candidate; a small local LLM then decides whether one answer fits both questions (`npm run verify`). A hit needs both.

![Paraphrases reused vs. hard negatives accepted](results/tradeoff.svg)

At a permissive threshold of 0.60 (no prefix), out of 18 paraphrases and 30 hard negatives:

| Policy | Paraphrases reused | Hard negatives accepted | Precision | Mean judge latency |
|---|---:|---:|---:|---:|
| threshold only | 100% | 100% | 38% | - |
| + qwen2.5:3b (plain prompt) | 83% | 0% | 100% | 1.7 s |
| + llama3.2:3b (plain prompt) | 0% | 0% | 100% | 1.7 s |
| + qwen2.5:7b (plain prompt) | 100% | 3% (1 of 30) | 95% | 3.9 s |
| + qwen2.5:7b (guided prompt) | 100% | 0% | 100% | 3.9 s |

What this shows:

- **A judge fixes what the threshold cannot.** qwen2.5:7b keeps every paraphrase and rejects 29 or 30 of the 30 hard negatives. Its single miss (plain prompt) treats "data collected" and "data shared with the sponsor" as the same question.
- **Safety alone is not enough to judge a judge.** llama3.2:3b answered "different" to every pair: zero wrong answers, zero savings. Any evaluation must report both sides.
- **The guided prompt barely matters.** It names this dataset's categories, so it could have inflated the scores; plain and guided results are nearly identical, which suggests the gain does not come from that leak.
- **The smaller qwen's misses are debatable.** It rejected "Who pays for transportation costs?" vs. "Are travel expenses reimbursed?", which arguably are different questions. The labels are human judgment, not ground truth.

What it costs and what it does not prove:

- **The judge runs on most traffic.** At 0.60 it is called for 86% of pairs. On these CPU runners each call took 1.7 to 3.9 s, which only pays off if the answer it saves is slower or more expensive than that. GPU latency should be much lower, but it was not measured here.
- **Small samples.** 0 errors in 30 hard negatives still allows a true error rate of up to about 10% (95% confidence, rule of three).
- **One order per pair.** Each pair was judged as A then B only; the judge may not be symmetric.
- **The chart nudges overlapping markers sideways** so all of them stay visible; read exact values from the table.

## Next steps

1. **Search against the whole cache**, not just pairs, to measure the error rate under realistic conditions.
2. **A larger, less hand-crafted dataset**, ideally built from real user questions, to estimate how often hard negatives actually occur.
3. **Judge both orders** of each pair and measure symmetry.
4. **A cost model:** judge latency and price against the generation it saves, on CPU and GPU.
5. **More embedding models and languages**, including multilingual ones.

## Context

This experiment grew out of studying LLM gateway patterns (semantic caching, model routing, confidence thresholds) in the AI Systems Architecture course of the Applied AI Software Engineering graduate program at UniPDS. The code and dataset in this repository are original.

## License

MIT.
