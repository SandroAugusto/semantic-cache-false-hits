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

## Next steps

1. **Verify before serving from cache:** instead of trusting the threshold alone, use the cache to find candidates and a second step (a reranker or a small LLM) to confirm both questions ask for the same answer. Measure how much safe savings that recovers.
2. **More embedding models**, including multilingual ones.
3. **Search against the whole cache**, not just pairs, to measure the error rate under realistic conditions.

## Context

This experiment grew out of studying LLM gateway patterns (semantic caching, model routing, confidence thresholds) in the AI Systems Architecture course of the Applied AI Software Engineering graduate program at UniPDS. The code and dataset in this repository are original.

## License

MIT.
