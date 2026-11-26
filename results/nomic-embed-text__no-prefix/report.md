# Results: nomic-embed-text | prefix: none

Pairs evaluated: 56. Cache hit = similarity >= threshold.

## At the reference threshold (0.75)

- Paraphrases reused: **56%**
- Hard negatives served as if they were the same question: **100%**
- Precision of what the cache returns: **25%**

## Safe threshold in this dataset

Lowest threshold with no hard negative becoming a hit: **0.994**. At that point the cache reuses **0%** of the paraphrases.

## Similarity by category

| Category | Pairs | Min | Mean | Max |
|---|---:|---:|---:|---:|
| paraphrase | 18 | 0.619 | 0.737 | 0.827 |
| antonym | 5 | 0.755 | 0.829 | 0.943 |
| negation | 5 | 0.899 | 0.932 | 0.973 |
| entity | 5 | 0.785 | 0.839 | 0.874 |
| number | 5 | 0.764 | 0.850 | 0.907 |
| scope | 5 | 0.765 | 0.816 | 0.874 |
| direction | 5 | 0.883 | 0.965 | 0.993 |
| unrelated | 8 | 0.264 | 0.398 | 0.473 |

## Threshold sweep

| Threshold | Paraphrases reused | Hard negatives accepted | Precision | antonym | negation | entity | number | scope | direction | unrelated |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0.60 | 100% | 100% | 38% | 100% | 100% | 100% | 100% | 100% | 100% | 0% |
| 0.65 | 89% | 100% | 35% | 100% | 100% | 100% | 100% | 100% | 100% | 0% |
| 0.70 | 72% | 100% | 30% | 100% | 100% | 100% | 100% | 100% | 100% | 0% |
| 0.75 | 56% | 100% | 25% | 100% | 100% | 100% | 100% | 100% | 100% | 0% |
| 0.80 | 11% | 77% | 8% | 60% | 100% | 80% | 60% | 60% | 100% | 0% |
| 0.85 | 0% | 60% | 0% | 20% | 100% | 40% | 60% | 40% | 100% | 0% |
| 0.90 | 0% | 33% | 0% | 20% | 80% | 0% | 20% | 0% | 80% | 0% |
| 0.95 | 0% | 17% | 0% | 0% | 20% | 0% | 0% | 0% | 80% | 0% |

## Most dangerous hard negatives

Different-meaning pairs with the highest similarity: the first ones to leak through the cache.

| Similarity | Category | Original question | New question |
|---:|---|---|---|
| 0.993 | direction | Does the sponsor pay the participant? | Does the participant pay the sponsor? |
| 0.992 | direction | Does the site send the data to the sponsor? | Does the sponsor send the data to the site? |
| 0.991 | direction | Can the participant call the team after hours? | Can the team call the participant after hours? |
| 0.973 | negation | In which cases is a participant removed from the study? | In which cases is a participant not removed from the study? |
| 0.968 | direction | Who notifies the ethics committee about adverse events? | Whom does the ethics committee notify about adverse events? |
| 0.947 | negation | Can pregnant women participate in the study? | Can pregnant women not participate in the study? |
| 0.943 | antonym | What is the minimum age to participate? | What is the maximum age to participate? |
| 0.936 | negation | Which tests require fasting? | Which tests do not require fasting? |
| 0.907 | number | Do 12-year-old participants need to give assent? | Do 17-year-old participants need to give assent? |
| 0.904 | negation | Which medications can I take during the study? | Which medications can I not take during the study? |

## Hardest paraphrases

Lowest similarity: the cache only reuses these with a low threshold.

| Similarity | Original question | New question |
|---:|---|---|
| 0.619 | What are the inclusion criteria for the study? | Who is eligible to take part in this trial? |
| 0.634 | How many participants will the study enroll? | What is the sample size of the trial? |
| 0.661 | Can I leave the study at any time? | Am I allowed to withdraw from the trial after it starts? |
| 0.664 | How long does the study last? | What is the total duration of the trial? |
| 0.686 | What happens if I have a side effect? | What should I do if I experience an adverse reaction? |
