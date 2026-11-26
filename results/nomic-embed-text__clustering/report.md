# Results: nomic-embed-text | prefix: "clustering: "

Pairs evaluated: 56. Cache hit = similarity >= threshold.

## At the reference threshold (0.75)

- Paraphrases reused: **94%**
- Hard negatives served as if they were the same question: **100%**
- Precision of what the cache returns: **36%**

## Safe threshold in this dataset

Lowest threshold with no hard negative becoming a hit: **0.998**. At that point the cache reuses **0%** of the paraphrases.

## Similarity by category

| Category | Pairs | Min | Mean | Max |
|---|---:|---:|---:|---:|
| paraphrase | 18 | 0.743 | 0.835 | 0.893 |
| antonym | 5 | 0.859 | 0.913 | 0.981 |
| negation | 5 | 0.965 | 0.980 | 0.992 |
| entity | 5 | 0.880 | 0.910 | 0.953 |
| number | 5 | 0.887 | 0.934 | 0.957 |
| scope | 5 | 0.828 | 0.896 | 0.965 |
| direction | 5 | 0.934 | 0.981 | 0.997 |
| unrelated | 8 | 0.547 | 0.614 | 0.672 |

## Threshold sweep

| Threshold | Paraphrases reused | Hard negatives accepted | Precision | antonym | negation | entity | number | scope | direction | unrelated |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0.60 | 100% | 100% | 34% | 100% | 100% | 100% | 100% | 100% | 100% | 63% |
| 0.65 | 100% | 100% | 37% | 100% | 100% | 100% | 100% | 100% | 100% | 13% |
| 0.70 | 100% | 100% | 38% | 100% | 100% | 100% | 100% | 100% | 100% | 0% |
| 0.75 | 94% | 100% | 36% | 100% | 100% | 100% | 100% | 100% | 100% | 0% |
| 0.80 | 83% | 100% | 33% | 100% | 100% | 100% | 100% | 100% | 100% | 0% |
| 0.85 | 44% | 97% | 22% | 100% | 100% | 100% | 100% | 80% | 100% | 0% |
| 0.90 | 0% | 73% | 0% | 60% | 100% | 60% | 80% | 40% | 100% | 0% |
| 0.95 | 0% | 50% | 0% | 20% | 100% | 20% | 60% | 20% | 80% | 0% |

## Most dangerous hard negatives

Different-meaning pairs with the highest similarity: the first ones to leak through the cache.

| Similarity | Category | Original question | New question |
|---:|---|---|---|
| 0.997 | direction | Does the sponsor pay the participant? | Does the participant pay the sponsor? |
| 0.997 | direction | Does the site send the data to the sponsor? | Does the sponsor send the data to the site? |
| 0.996 | direction | Can the participant call the team after hours? | Can the team call the participant after hours? |
| 0.992 | negation | In which cases is a participant removed from the study? | In which cases is a participant not removed from the study? |
| 0.986 | negation | Can pregnant women participate in the study? | Can pregnant women not participate in the study? |
| 0.982 | negation | Which tests require fasting? | Which tests do not require fasting? |
| 0.981 | antonym | What is the minimum age to participate? | What is the maximum age to participate? |
| 0.980 | direction | Who notifies the ethics committee about adverse events? | Whom does the ethics committee notify about adverse events? |
| 0.974 | negation | Which expenses are reimbursed? | Which expenses are not reimbursed? |
| 0.965 | negation | Which medications can I take during the study? | Which medications can I not take during the study? |

## Hardest paraphrases

Lowest similarity: the cache only reuses these with a low threshold.

| Similarity | Original question | New question |
|---:|---|---|
| 0.743 | What are the inclusion criteria for the study? | Who is eligible to take part in this trial? |
| 0.775 | How many participants will the study enroll? | What is the sample size of the trial? |
| 0.786 | Can I leave the study at any time? | Am I allowed to withdraw from the trial after it starts? |
| 0.804 | How long does the study last? | What is the total duration of the trial? |
| 0.821 | What happens if I have a side effect? | What should I do if I experience an adverse reaction? |
