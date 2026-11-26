# Results: nomic-embed-text | prefix: "search_query: "

Pairs evaluated: 56. Cache hit = similarity >= threshold.

## At the reference threshold (0.75)

- Paraphrases reused: **67%**
- Hard negatives served as if they were the same question: **100%**
- Precision of what the cache returns: **29%**

## Safe threshold in this dataset

Lowest threshold with no hard negative becoming a hit: **0.996**. At that point the cache reuses **0%** of the paraphrases.

## Similarity by category

| Category | Pairs | Min | Mean | Max |
|---|---:|---:|---:|---:|
| paraphrase | 18 | 0.656 | 0.757 | 0.840 |
| antonym | 5 | 0.767 | 0.845 | 0.948 |
| negation | 5 | 0.915 | 0.941 | 0.973 |
| entity | 5 | 0.801 | 0.839 | 0.872 |
| number | 5 | 0.792 | 0.851 | 0.895 |
| scope | 5 | 0.764 | 0.812 | 0.895 |
| direction | 5 | 0.909 | 0.974 | 0.996 |
| unrelated | 8 | 0.362 | 0.456 | 0.516 |

## Threshold sweep

| Threshold | Paraphrases reused | Hard negatives accepted | Precision | antonym | negation | entity | number | scope | direction | unrelated |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0.60 | 100% | 100% | 38% | 100% | 100% | 100% | 100% | 100% | 100% | 0% |
| 0.65 | 100% | 100% | 38% | 100% | 100% | 100% | 100% | 100% | 100% | 0% |
| 0.70 | 83% | 100% | 33% | 100% | 100% | 100% | 100% | 100% | 100% | 0% |
| 0.75 | 67% | 100% | 29% | 100% | 100% | 100% | 100% | 100% | 100% | 0% |
| 0.80 | 17% | 83% | 11% | 80% | 100% | 100% | 80% | 40% | 100% | 0% |
| 0.85 | 0% | 63% | 0% | 40% | 100% | 40% | 60% | 40% | 100% | 0% |
| 0.90 | 0% | 37% | 0% | 20% | 100% | 0% | 0% | 0% | 100% | 0% |
| 0.95 | 0% | 20% | 0% | 0% | 40% | 0% | 0% | 0% | 80% | 0% |

## Most dangerous hard negatives

Different-meaning pairs with the highest similarity: the first ones to leak through the cache.

| Similarity | Category | Original question | New question |
|---:|---|---|---|
| 0.996 | direction | Does the sponsor pay the participant? | Does the participant pay the sponsor? |
| 0.996 | direction | Can the participant call the team after hours? | Can the team call the participant after hours? |
| 0.995 | direction | Does the site send the data to the sponsor? | Does the sponsor send the data to the site? |
| 0.974 | direction | Who notifies the ethics committee about adverse events? | Whom does the ethics committee notify about adverse events? |
| 0.973 | negation | In which cases is a participant removed from the study? | In which cases is a participant not removed from the study? |
| 0.960 | negation | Can pregnant women participate in the study? | Can pregnant women not participate in the study? |
| 0.948 | antonym | What is the minimum age to participate? | What is the maximum age to participate? |
| 0.940 | negation | Which tests require fasting? | Which tests do not require fasting? |
| 0.920 | negation | Which expenses are reimbursed? | Which expenses are not reimbursed? |
| 0.915 | negation | Which medications can I take during the study? | Which medications can I not take during the study? |

## Hardest paraphrases

Lowest similarity: the cache only reuses these with a low threshold.

| Similarity | Original question | New question |
|---:|---|---|
| 0.656 | What are the inclusion criteria for the study? | Who is eligible to take part in this trial? |
| 0.663 | How many participants will the study enroll? | What is the sample size of the trial? |
| 0.698 | Can I leave the study at any time? | Am I allowed to withdraw from the trial after it starts? |
| 0.706 | How long does the study last? | What is the total duration of the trial? |
| 0.710 | What happens if I have a side effect? | What should I do if I experience an adverse reaction? |
