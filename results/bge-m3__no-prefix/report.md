# Results: bge-m3 | prefix: none | weights: 790764642607

Pairs evaluated: 56. Cache hit = similarity >= threshold.

## At the reference threshold (0.75)

- Paraphrases reused: **67%**
- Hard negatives served as if they were the same question: **90%**
- Precision of what the cache returns: **31%**

## Safe threshold in this dataset

Lowest threshold with no hard negative becoming a hit: **0.992**. At that point the cache reuses **0%** of the paraphrases.

## Similarity by category

| Category | Pairs | Min | Mean | Max |
|---|---:|---:|---:|---:|
| paraphrase | 18 | 0.650 | 0.775 | 0.872 |
| antonym | 5 | 0.738 | 0.841 | 0.907 |
| negation | 5 | 0.849 | 0.887 | 0.926 |
| entity | 5 | 0.772 | 0.820 | 0.852 |
| number | 5 | 0.727 | 0.822 | 0.874 |
| scope | 5 | 0.717 | 0.808 | 0.859 |
| direction | 5 | 0.893 | 0.968 | 0.991 |
| unrelated | 8 | 0.344 | 0.440 | 0.533 |

## Threshold sweep

| Threshold | Paraphrases reused | Hard negatives accepted | Precision | antonym | negation | entity | number | scope | direction | unrelated |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0.60 | 100% | 100% | 38% | 100% | 100% | 100% | 100% | 100% | 100% | 0% |
| 0.65 | 100% | 100% | 38% | 100% | 100% | 100% | 100% | 100% | 100% | 0% |
| 0.70 | 83% | 100% | 33% | 100% | 100% | 100% | 100% | 100% | 100% | 0% |
| 0.75 | 67% | 90% | 31% | 80% | 100% | 100% | 80% | 80% | 100% | 0% |
| 0.80 | 28% | 77% | 18% | 80% | 100% | 60% | 60% | 60% | 100% | 0% |
| 0.85 | 22% | 57% | 19% | 60% | 80% | 40% | 40% | 20% | 100% | 0% |
| 0.90 | 0% | 23% | 0% | 20% | 40% | 0% | 0% | 0% | 80% | 0% |
| 0.95 | 0% | 13% | 0% | 0% | 0% | 0% | 0% | 0% | 80% | 0% |

## Most dangerous hard negatives

Different-meaning pairs with the highest similarity: the first ones to leak through the cache.

| Similarity | Category | Original question | New question |
|---:|---|---|---|
| 0.991 | direction | Who notifies the ethics committee about adverse events? | Whom does the ethics committee notify about adverse events? |
| 0.990 | direction | Can the participant call the team after hours? | Can the team call the participant after hours? |
| 0.985 | direction | Does the sponsor pay the participant? | Does the participant pay the sponsor? |
| 0.983 | direction | Does the site send the data to the sponsor? | Does the sponsor send the data to the site? |
| 0.926 | negation | Can pregnant women participate in the study? | Can pregnant women not participate in the study? |
| 0.920 | negation | Which medications can I take during the study? | Which medications can I not take during the study? |
| 0.907 | antonym | What is the minimum age to participate? | What is the maximum age to participate? |
| 0.893 | direction | Does the doctor tell the participant about the results? | Does the participant tell the doctor about the symptoms? |
| 0.877 | antonym | What are the inclusion criteria for the study? | What are the exclusion criteria for the study? |
| 0.874 | negation | Which expenses are reimbursed? | Which expenses are not reimbursed? |

## Hardest paraphrases

Lowest similarity: the cache only reuses these with a low threshold.

| Similarity | Original question | New question |
|---:|---|---|
| 0.650 | What are the inclusion criteria for the study? | Who is eligible to take part in this trial? |
| 0.660 | Can I leave the study at any time? | Am I allowed to withdraw from the trial after it starts? |
| 0.690 | How many participants will the study enroll? | What is the sample size of the trial? |
| 0.721 | Which blood tests will be done? | What lab work on blood samples does the study include? |
| 0.721 | How long does the study last? | What is the total duration of the trial? |
