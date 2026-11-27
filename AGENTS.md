# Instructions for agents working on this repository

Read by coding and reviewing agents (Codex, Claude Code, and similar). `README.md`
describes the experiments, the metrics and the limitations. Read it first.

## What this project is

A measurement of how often a semantic cache serves the answer to a different
question. The deliverable is a set of numbers and the claims built on them.
The worst defect is therefore a **plausible wrong rate**: a hit counted on the
wrong side, a denominator that drops cases, a label read backwards, a cache that
returns a stale verdict. Nothing crashes, and the README ends up claiming
something the data does not show.

## Working on the code

- Node.js 22.18+ runs the TypeScript directly: no build step, relative imports
  carry the `.ts` extension, and only erasable syntax is allowed (no `enum`, no
  parameter properties).
- There are no runtime dependencies, on purpose: `fetch`, `node:test`,
  `node:util` and `node:crypto` cover everything. A new dependency needs a
  reason in the PR description.
- `npm test` and `npm run typecheck` must pass. Neither needs Ollama.
- Logic that produces a number stays free of I/O (`src/metrics.ts`,
  `src/whole-cache.ts`) so it can be tested directly. The entry points
  (`run.ts`, `verify.ts`, `cache-sim.ts`) do the I/O.
- Files under `results/` are written by the GitHub Actions workflows. Do not
  edit them by hand; change the code or the data and let a run regenerate them.
- Everything in the repository is in English.

## Code Review Rules

### Metric definitions

- A cache hit is `similarity >= threshold`. Flag a `>` where the rest of the code
  uses `>=`, and the reverse.
- `hitRate` is over pairs labeled `same`; `falseHitRate` over pairs labeled
  `different`; `hardNegativeFalseHitRate` over the six hard-negative categories
  only; `precision` is correct hits over all hits, and 1 when there are no hits.
  Flag a change to a numerator or a denominator that the PR does not announce.
- Only `paraphrase` pairs may be labeled `same` (`src/dataset.ts` enforces it).
  Flag a change that relaxes that check or adds a category without updating
  `CATEGORIES`, `HARD_NEGATIVE_CATEGORIES` and the README table together.
- Rates are fractions in [0, 1] everywhere; multiplying by 100 happens only when
  a report is rendered. Flag arithmetic that mixes the two.

### Whole-cache simulation (Track A)

- A query served an original other than its own is **unlabeled** by the dataset.
  It is counted apart (`rewriteOther`, `relatedOther`) and reported as an upper
  bound on wrong answers. Flag code that folds those hits into "correct" or
  drops them from the totals.
- The invariants hold for every policy: own + other + miss equals the number of
  queries, for rewrites and for related questions. A new counter comes with a
  test that asserts them.
- A judge policy needs the threshold **and** the judge's verdict. Flag a path
  where a judge verdict alone, or a missing verdict, produces a hit.
- When the time budget stops judging early, the report covers only the queries
  judged, and says so. Flag a rate computed over the planned sample instead.

### Judge and embedding handling

- A judge reply that cannot be parsed is `same: false, valid: false`: no hit, and
  counted as invalid in the report. Flag a default of `true`, or invalid replies
  dropped without being counted.
- Cache keys include everything that changes the output: model, prefix and text
  for embeddings; model, system prompt and both questions, in order, for
  verdicts. Flag a new input (an option, a prompt template, a pair order) that
  affects the output and is missing from the key: it makes a rerun read stale
  results as if they were fresh.
- Judge latency is the model time reported by Ollama, and the warm-up call stays
  out of it. Flag a change that measures wall-clock time including model load.
- `temperature: 0` and the JSON schema stay on every judge call.

### Reproducibility

- Sampling goes through `seededShuffle` with the seed taken from the options and
  printed in the report. Flag `Math.random` anywhere in the pipeline.
- Thresholds come from `thresholdGrid`, which indexes by integer and rounds each
  point. Flag a loop that accumulates `t += step`.

### Claims in the README

- Every number in `README.md` must be traceable to a file under `results/`. When
  a PR changes a metric, a prompt, a dataset or a default, flag README figures
  the change makes stale.
- The "guided" prompt names this dataset's categories; its scores are an upper
  bound and the README says so. Flag a new prompt or example that contains pairs
  or wording from `data/pairs.jsonl` without the same disclosure.
- Keep limitations next to the results they qualify (sample size, one order per
  pair, CPU-only latency). Flag a PR that strengthens a claim and removes the
  caveat.

### Dataset hygiene

- `data/pairs.jsonl` is hand-written and original. Each hard negative changes
  one thing, and that thing matches its category. Flag a pair whose label is
  debatable or whose category is wrong, and say why.
- Text from the Medical Question Pairs dataset never enters the repository: not
  in code, tests, fixtures, reports or CSVs (see `SECURITY.md`). Tests of the
  Track A code use invented questions.

### Tests

- A change to a metric or to the simulation comes with a test whose expected
  values are worked out by hand in the test, not copied from the function's
  output.

### Out of scope for review

Do not comment on naming or formatting, and do not ask for abstractions, a
framework or a dependency. The repository is small on purpose.

## How to report

- One finding per comment, anchored to a line, most severe first.
- State the scenario concretely: _these pairs or queries → value reported, value
  expected_.
- Say whether you ran it. A finding you did not reproduce is marked `unverified`.
- No praise and no summary of the diff. If nothing is wrong, say so in one line.
- End every comment and review with a signature line, e.g.
  `— automated review (codex)`.
