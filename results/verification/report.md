# Experiment 2: verify before serving from cache

Embeddings: nomic-embed-text | prefix: none. A hit requires similarity >= threshold **and** the judge saying both questions share one answer. Pairs evaluated: 56.

> The `guided` prompt names the kinds of change this dataset tests (negation, direction, numbers, entities, scope), so it is tuned to the test set. Read its scores as an upper bound.

## The judge on its own

Share of pairs each judge classifies correctly, by category.

| Judge | paraphrase | antonym | negation | entity | number | scope | direction | unrelated | Invalid replies | Mean latency | p95 latency |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| qwen2.5:3b (plain) | 83% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 0 | 1680 ms | 1926 ms |
| qwen2.5:3b (guided) | 83% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 0 | 1697 ms | 1904 ms |
| llama3.2:3b (plain) | 0% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 0 | 1665 ms | 1917 ms |
| llama3.2:3b (guided) | 0% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 0 | 1692 ms | 1973 ms |
| qwen2.5:7b (plain) | 100% | 100% | 100% | 100% | 100% | 80% | 100% | 100% | 0 | 3923 ms | 4504 ms |
| qwen2.5:7b (guided) | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 0 | 3934 ms | 4432 ms |

## Threshold alone vs. threshold + judge

"Judge calls" is the share of pairs whose similarity reaches the threshold, i.e. how often the judge would run.

| Policy | Threshold | Paraphrases reused | Hard negatives accepted | Unrelated accepted | Precision | Judge calls |
|---|---:|---:|---:|---:|---:|---:|
| threshold only | 0.60 | 100% | 100% | 0% | 38% | - |
| qwen2.5:3b (plain) | 0.60 | 83% | 0% | 0% | 100% | 86% |
| qwen2.5:3b (guided) | 0.60 | 83% | 0% | 0% | 100% | 86% |
| llama3.2:3b (plain) | 0.60 | 0% | 0% | 0% | 100% | 86% |
| llama3.2:3b (guided) | 0.60 | 0% | 0% | 0% | 100% | 86% |
| qwen2.5:7b (plain) | 0.60 | 100% | 3% | 0% | 95% | 86% |
| qwen2.5:7b (guided) | 0.60 | 100% | 0% | 0% | 100% | 86% |
| threshold only | 0.65 | 89% | 100% | 0% | 35% | - |
| qwen2.5:3b (plain) | 0.65 | 72% | 0% | 0% | 100% | 82% |
| qwen2.5:3b (guided) | 0.65 | 72% | 0% | 0% | 100% | 82% |
| llama3.2:3b (plain) | 0.65 | 0% | 0% | 0% | 100% | 82% |
| llama3.2:3b (guided) | 0.65 | 0% | 0% | 0% | 100% | 82% |
| qwen2.5:7b (plain) | 0.65 | 89% | 3% | 0% | 94% | 82% |
| qwen2.5:7b (guided) | 0.65 | 89% | 0% | 0% | 100% | 82% |
| threshold only | 0.70 | 72% | 100% | 0% | 30% | - |
| qwen2.5:3b (plain) | 0.70 | 56% | 0% | 0% | 100% | 77% |
| qwen2.5:3b (guided) | 0.70 | 56% | 0% | 0% | 100% | 77% |
| llama3.2:3b (plain) | 0.70 | 0% | 0% | 0% | 100% | 77% |
| llama3.2:3b (guided) | 0.70 | 0% | 0% | 0% | 100% | 77% |
| qwen2.5:7b (plain) | 0.70 | 72% | 3% | 0% | 93% | 77% |
| qwen2.5:7b (guided) | 0.70 | 72% | 0% | 0% | 100% | 77% |
| threshold only | 0.75 | 56% | 100% | 0% | 25% | - |
| qwen2.5:3b (plain) | 0.75 | 50% | 0% | 0% | 100% | 71% |
| qwen2.5:3b (guided) | 0.75 | 50% | 0% | 0% | 100% | 71% |
| llama3.2:3b (plain) | 0.75 | 0% | 0% | 0% | 100% | 71% |
| llama3.2:3b (guided) | 0.75 | 0% | 0% | 0% | 100% | 71% |
| qwen2.5:7b (plain) | 0.75 | 56% | 3% | 0% | 91% | 71% |
| qwen2.5:7b (guided) | 0.75 | 56% | 0% | 0% | 100% | 71% |

## Judge mistakes

### qwen2.5:3b (plain): 3 of 56 pairs wrong

| Category | Expected | Judge said | Question A | Question B |
|---|---|---|---|---|
| paraphrase | same | different | Who pays for transportation costs? | Are travel expenses reimbursed? |
| paraphrase | same | different | Is there a placebo group? | Will some participants receive a placebo? |
| paraphrase | same | different | Who do I contact if I have questions? | How can I reach the study team with my questions? |

### qwen2.5:3b (guided): 3 of 56 pairs wrong

| Category | Expected | Judge said | Question A | Question B |
|---|---|---|---|---|
| paraphrase | same | different | Who pays for transportation costs? | Are travel expenses reimbursed? |
| paraphrase | same | different | Is there a placebo group? | Will some participants receive a placebo? |
| paraphrase | same | different | Who do I contact if I have questions? | How can I reach the study team with my questions? |

### llama3.2:3b (plain): 18 of 56 pairs wrong

| Category | Expected | Judge said | Question A | Question B |
|---|---|---|---|---|
| paraphrase | same | different | What are the inclusion criteria for the study? | Who is eligible to take part in this trial? |
| paraphrase | same | different | What is the minimum age to participate? | How old do you have to be to join the study? |
| paraphrase | same | different | How long does the study last? | What is the total duration of the trial? |
| paraphrase | same | different | What are the risks of participating? | What dangers does a participant face by joining the study? |
| paraphrase | same | different | Do participants get paid? | Is there any compensation for taking part? |
| paraphrase | same | different | Can I leave the study at any time? | Am I allowed to withdraw from the trial after it starts? |
| paraphrase | same | different | How many visits to the research site are required? | How many times does a participant need to go to the study site? |
| paraphrase | same | different | Which blood tests will be done? | What lab work on blood samples does the study include? |
| paraphrase | same | different | What happens if I have a side effect? | What should I do if I experience an adverse reaction? |
| paraphrase | same | different | Will my personal data be kept confidential? | Does the study protect the privacy of my information? |
| paraphrase | same | different | Which drug is being tested? | What medication is the trial evaluating? |
| paraphrase | same | different | Can pregnant women participate? | Are pregnant participants accepted into the study? |
| paraphrase | same | different | Who pays for transportation costs? | Are travel expenses reimbursed? |
| paraphrase | same | different | Is there a placebo group? | Will some participants receive a placebo? |
| paraphrase | same | different | Who do I contact if I have questions? | How can I reach the study team with my questions? |
| paraphrase | same | different | How many participants will the study enroll? | What is the sample size of the trial? |
| paraphrase | same | different | Do I need to fast before blood draws? | Is fasting required before giving blood samples? |
| paraphrase | same | different | Was the study approved by an ethics committee? | Does the trial have ethics board approval? |

### llama3.2:3b (guided): 18 of 56 pairs wrong

| Category | Expected | Judge said | Question A | Question B |
|---|---|---|---|---|
| paraphrase | same | different | What are the inclusion criteria for the study? | Who is eligible to take part in this trial? |
| paraphrase | same | different | What is the minimum age to participate? | How old do you have to be to join the study? |
| paraphrase | same | different | How long does the study last? | What is the total duration of the trial? |
| paraphrase | same | different | What are the risks of participating? | What dangers does a participant face by joining the study? |
| paraphrase | same | different | Do participants get paid? | Is there any compensation for taking part? |
| paraphrase | same | different | Can I leave the study at any time? | Am I allowed to withdraw from the trial after it starts? |
| paraphrase | same | different | How many visits to the research site are required? | How many times does a participant need to go to the study site? |
| paraphrase | same | different | Which blood tests will be done? | What lab work on blood samples does the study include? |
| paraphrase | same | different | What happens if I have a side effect? | What should I do if I experience an adverse reaction? |
| paraphrase | same | different | Will my personal data be kept confidential? | Does the study protect the privacy of my information? |
| paraphrase | same | different | Which drug is being tested? | What medication is the trial evaluating? |
| paraphrase | same | different | Can pregnant women participate? | Are pregnant participants accepted into the study? |
| paraphrase | same | different | Who pays for transportation costs? | Are travel expenses reimbursed? |
| paraphrase | same | different | Is there a placebo group? | Will some participants receive a placebo? |
| paraphrase | same | different | Who do I contact if I have questions? | How can I reach the study team with my questions? |
| paraphrase | same | different | How many participants will the study enroll? | What is the sample size of the trial? |
| paraphrase | same | different | Do I need to fast before blood draws? | Is fasting required before giving blood samples? |
| paraphrase | same | different | Was the study approved by an ethics committee? | Does the trial have ethics board approval? |

### qwen2.5:7b (plain): 1 of 56 pairs wrong

| Category | Expected | Judge said | Question A | Question B |
|---|---|---|---|---|
| scope | different | same | Which participant data is collected? | Which participant data is shared with the sponsor? |

### qwen2.5:7b (guided): 0 of 56 pairs wrong
