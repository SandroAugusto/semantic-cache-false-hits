# Results: mxbai-embed-large | prefix: none | weights: 468836162de7

Pairs evaluated: 56. Cache hit = similarity >= threshold.

## At the reference threshold (0.75)

- Paraphrases reused: **50%**
- Hard negatives served as if they were the same question: **93%**
- Precision of what the cache returns: **24%**

## Safe threshold in this dataset

Lowest threshold with no hard negative becoming a hit: **0.992**. At that point the cache reuses **0%** of the paraphrases.

## Similarity by category

| Category | Pairs | Min | Mean | Max |
|---|---:|---:|---:|---:|
| paraphrase | 18 | 0.568 | 0.744 | 0.879 |
| antonym | 5 | 0.751 | 0.813 | 0.895 |
| negation | 5 | 0.825 | 0.871 | 0.915 |
| entity | 5 | 0.777 | 0.807 | 0.850 |
| number | 5 | 0.776 | 0.830 | 0.885 |
| scope | 5 | 0.640 | 0.761 | 0.848 |
| direction | 5 | 0.860 | 0.961 | 0.991 |
| unrelated | 8 | 0.301 | 0.370 | 0.421 |

## Threshold sweep

| Threshold | Paraphrases reused | Hard negatives accepted | Precision | antonym | negation | entity | number | scope | direction | unrelated |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0.60 | 89% | 100% | 35% | 100% | 100% | 100% | 100% | 100% | 100% | 0% |
| 0.65 | 83% | 97% | 34% | 100% | 100% | 100% | 100% | 80% | 100% | 0% |
| 0.70 | 78% | 97% | 33% | 100% | 100% | 100% | 100% | 80% | 100% | 0% |
| 0.75 | 50% | 93% | 24% | 100% | 100% | 100% | 100% | 60% | 100% | 0% |
| 0.80 | 33% | 67% | 23% | 60% | 100% | 40% | 80% | 20% | 100% | 0% |
| 0.85 | 6% | 40% | 8% | 40% | 60% | 0% | 40% | 0% | 100% | 0% |
| 0.90 | 0% | 17% | 0% | 0% | 20% | 0% | 0% | 0% | 80% | 0% |
| 0.95 | 0% | 13% | 0% | 0% | 0% | 0% | 0% | 0% | 80% | 0% |

## Most dangerous hard negatives

Different-meaning pairs with the highest similarity: the first ones to leak through the cache.

| Similarity | Category | Original question | New question |
|---:|---|---|---|
| 0.991 | direction | Does the sponsor pay the participant? | Does the participant pay the sponsor? |
| 0.991 | direction | Does the site send the data to the sponsor? | Does the sponsor send the data to the site? |
| 0.984 | direction | Can the participant call the team after hours? | Can the team call the participant after hours? |
| 0.980 | direction | Who notifies the ethics committee about adverse events? | Whom does the ethics committee notify about adverse events? |
| 0.915 | negation | Which medications can I take during the study? | Which medications can I not take during the study? |
| 0.895 | antonym | What is the minimum age to participate? | What is the maximum age to participate? |
| 0.892 | negation | Can pregnant women participate in the study? | Can pregnant women not participate in the study? |
| 0.885 | number | Do 12-year-old participants need to give assent? | Do 17-year-old participants need to give assent? |
| 0.884 | negation | In which cases is a participant removed from the study? | In which cases is a participant not removed from the study? |
| 0.867 | number | How many participants dropped out in the first month? | How many participants dropped out in the sixth month? |

## Hardest paraphrases

Lowest similarity: the cache only reuses these with a low threshold.

| Similarity | Original question | New question |
|---:|---|---|
| 0.568 | Can I leave the study at any time? | Am I allowed to withdraw from the trial after it starts? |
| 0.598 | What are the inclusion criteria for the study? | Who is eligible to take part in this trial? |
| 0.628 | How long does the study last? | What is the total duration of the trial? |
| 0.670 | Who pays for transportation costs? | Are travel expenses reimbursed? |
| 0.717 | How many participants will the study enroll? | What is the sample size of the trial? |
