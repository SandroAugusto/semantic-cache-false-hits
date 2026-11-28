# Experiment 2: verify before serving from cache

Embeddings: nomic-embed-text | prefix: none. A hit requires similarity >= threshold **and** the judge saying both questions share one answer. Pairs evaluated: 56.

Weights (Ollama digests): nomic-embed-text 0a109f422b47, qwen2.5:3b 357c53fb659c, llama3.2:3b a80c4f17acd5, qwen2.5:7b 845dbda0ea48.

> The `guided` prompt names the kinds of change this dataset tests (negation, direction, numbers, entities, scope), so it is tuned to the test set. Read its scores as an upper bound.

## The judge on its own

Share of pairs each judge classifies correctly, by category.

| Judge | paraphrase | antonym | negation | entity | number | scope | direction | unrelated | Invalid replies | Mean latency | p95 latency |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| qwen2.5:3b (plain) | 78% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 0 | 888 ms | 921 ms |
| qwen2.5:3b (guided) | 83% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 0 | 903 ms | 938 ms |
| llama3.2:3b (plain) | 0% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 0 | 884 ms | 933 ms |
| llama3.2:3b (guided) | 0% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 0 | 899 ms | 944 ms |
| qwen2.5:7b (plain) | 100% | 100% | 100% | 100% | 100% | 80% | 100% | 100% | 0 | 1865 ms | 1952 ms |
| qwen2.5:7b (guided) | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 0 | 1876 ms | 1969 ms |

## Threshold alone vs. threshold + judge

"Pairs judged" is the share of pairs whose similarity reaches the threshold, i.e. how often the judge would run. "Judge calls per pair" is the inference volume: the same share for a policy that asks once, twice that for a both-orders policy, which asks the judge twice about every candidate.

"Break-even generation" is the generation time above which the judge saves time: a judge call costs the mean judge latency, and only the calls that end in a hit save a generation, so the break-even is the mean judge latency divided by the share of judge calls that end in a hit. Below it, calling the model directly is faster. Latencies are from these CPU runners.

| Policy | Threshold | Paraphrases reused | Hard negatives accepted | Unrelated accepted | Precision | Pairs judged | Judge calls per pair | Break-even generation |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| threshold only | 0.60 | 100% | 100% | 0% | 38% | - | - | - |
| qwen2.5:3b (plain) | 0.60 | 78% | 0% | 0% | 100% | 86% | 0.86 | 3044 ms |
| qwen2.5:3b (plain), both orders | 0.60 | 72% | 0% | 0% | 100% | 86% | 1.71 | 6510 ms |
| qwen2.5:3b (guided) | 0.60 | 83% | 0% | 0% | 100% | 86% | 0.86 | 2890 ms |
| qwen2.5:3b (guided), both orders | 0.60 | 78% | 0% | 0% | 100% | 86% | 1.71 | 6136 ms |
| llama3.2:3b (plain) | 0.60 | 0% | 0% | 0% | 100% | 86% | 0.86 | - |
| llama3.2:3b (plain), both orders | 0.60 | 0% | 0% | 0% | 100% | 86% | 1.71 | - |
| llama3.2:3b (guided) | 0.60 | 0% | 0% | 0% | 100% | 86% | 0.86 | - |
| llama3.2:3b (guided), both orders | 0.60 | 0% | 0% | 0% | 100% | 86% | 1.71 | - |
| qwen2.5:7b (plain) | 0.60 | 100% | 3% | 0% | 95% | 86% | 0.86 | 4710 ms |
| qwen2.5:7b (plain), both orders | 0.60 | 100% | 0% | 0% | 100% | 86% | 1.71 | 9858 ms |
| qwen2.5:7b (guided) | 0.60 | 100% | 0% | 0% | 100% | 86% | 0.86 | 5003 ms |
| qwen2.5:7b (guided), both orders | 0.60 | 100% | 0% | 0% | 100% | 86% | 1.71 | 9890 ms |
| threshold only | 0.65 | 89% | 100% | 0% | 35% | - | - | - |
| qwen2.5:3b (plain) | 0.65 | 67% | 0% | 0% | 100% | 82% | 0.82 | 3404 ms |
| qwen2.5:3b (plain), both orders | 0.65 | 67% | 0% | 0% | 100% | 82% | 1.64 | 6759 ms |
| qwen2.5:3b (guided) | 0.65 | 72% | 0% | 0% | 100% | 82% | 0.82 | 3195 ms |
| qwen2.5:3b (guided), both orders | 0.65 | 72% | 0% | 0% | 100% | 82% | 1.64 | 6333 ms |
| llama3.2:3b (plain) | 0.65 | 0% | 0% | 0% | 100% | 82% | 0.82 | - |
| llama3.2:3b (plain), both orders | 0.65 | 0% | 0% | 0% | 100% | 82% | 1.64 | - |
| llama3.2:3b (guided) | 0.65 | 0% | 0% | 0% | 100% | 82% | 0.82 | - |
| llama3.2:3b (guided), both orders | 0.65 | 0% | 0% | 0% | 100% | 82% | 1.64 | - |
| qwen2.5:7b (plain) | 0.65 | 89% | 3% | 0% | 94% | 82% | 0.82 | 5045 ms |
| qwen2.5:7b (plain), both orders | 0.65 | 89% | 0% | 0% | 100% | 82% | 1.64 | 10628 ms |
| qwen2.5:7b (guided) | 0.65 | 89% | 0% | 0% | 100% | 82% | 0.82 | 5393 ms |
| qwen2.5:7b (guided), both orders | 0.65 | 89% | 0% | 0% | 100% | 82% | 1.64 | 10663 ms |
| threshold only | 0.70 | 72% | 100% | 0% | 30% | - | - | - |
| qwen2.5:3b (plain) | 0.70 | 56% | 0% | 0% | 100% | 77% | 0.77 | 3818 ms |
| qwen2.5:3b (plain), both orders | 0.70 | 56% | 0% | 0% | 100% | 77% | 1.54 | 7581 ms |
| qwen2.5:3b (guided) | 0.70 | 56% | 0% | 0% | 100% | 77% | 0.77 | 3883 ms |
| qwen2.5:3b (guided), both orders | 0.70 | 56% | 0% | 0% | 100% | 77% | 1.54 | 7696 ms |
| llama3.2:3b (plain) | 0.70 | 0% | 0% | 0% | 100% | 77% | 0.77 | - |
| llama3.2:3b (plain), both orders | 0.70 | 0% | 0% | 0% | 100% | 77% | 1.54 | - |
| llama3.2:3b (guided) | 0.70 | 0% | 0% | 0% | 100% | 77% | 0.77 | - |
| llama3.2:3b (guided), both orders | 0.70 | 0% | 0% | 0% | 100% | 77% | 1.54 | - |
| qwen2.5:7b (plain) | 0.70 | 72% | 3% | 0% | 93% | 77% | 0.77 | 5727 ms |
| qwen2.5:7b (plain), both orders | 0.70 | 72% | 0% | 0% | 100% | 77% | 1.54 | 12227 ms |
| qwen2.5:7b (guided) | 0.70 | 72% | 0% | 0% | 100% | 77% | 0.77 | 6205 ms |
| qwen2.5:7b (guided), both orders | 0.70 | 72% | 0% | 0% | 100% | 77% | 1.54 | 12268 ms |
| threshold only | 0.75 | 56% | 100% | 0% | 25% | - | - | - |
| qwen2.5:3b (plain) | 0.75 | 50% | 0% | 0% | 100% | 71% | 0.71 | 3946 ms |
| qwen2.5:3b (plain), both orders | 0.75 | 50% | 0% | 0% | 100% | 71% | 1.43 | 7836 ms |
| qwen2.5:3b (guided) | 0.75 | 50% | 0% | 0% | 100% | 71% | 0.71 | 4013 ms |
| qwen2.5:3b (guided), both orders | 0.75 | 50% | 0% | 0% | 100% | 71% | 1.43 | 7954 ms |
| llama3.2:3b (plain) | 0.75 | 0% | 0% | 0% | 100% | 71% | 0.71 | - |
| llama3.2:3b (plain), both orders | 0.75 | 0% | 0% | 0% | 100% | 71% | 1.43 | - |
| llama3.2:3b (guided) | 0.75 | 0% | 0% | 0% | 100% | 71% | 0.71 | - |
| llama3.2:3b (guided), both orders | 0.75 | 0% | 0% | 0% | 100% | 71% | 1.43 | - |
| qwen2.5:7b (plain) | 0.75 | 56% | 3% | 0% | 91% | 71% | 0.71 | 6780 ms |
| qwen2.5:7b (plain), both orders | 0.75 | 56% | 0% | 0% | 100% | 71% | 1.43 | 14787 ms |
| qwen2.5:7b (guided) | 0.75 | 56% | 0% | 0% | 100% | 71% | 0.71 | 7504 ms |
| qwen2.5:7b (guided), both orders | 0.75 | 56% | 0% | 0% | 100% | 71% | 1.43 | 14835 ms |

## Order symmetry

Each pair judged twice, A then B and B then A. A judge that answers differently for the same two questions is not deciding on meaning alone.

| Judge | Pairs answered differently by order | Of them, hard negatives |
|---|---:|---:|
| qwen2.5:3b (plain) | 4 of 56 | 0 |
| qwen2.5:3b (guided) | 3 of 56 | 0 |
| llama3.2:3b (plain) | 0 of 56 | 0 |
| llama3.2:3b (guided) | 0 of 56 | 0 |
| qwen2.5:7b (plain) | 1 of 56 | 1 |
| qwen2.5:7b (guided) | 0 of 56 | 0 |

## Judge mistakes

### qwen2.5:3b (plain): 4 of 56 pairs wrong

| Category | Expected | Judge said | Question A | Question B |
|---|---|---|---|---|
| paraphrase | same | different | How long does the study last? | What is the total duration of the trial? |
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
