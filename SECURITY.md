# Security

## What this repository is

A set of command-line experiments. They read question pairs, call a local
[Ollama](https://ollama.com) server for embeddings and judge verdicts, and write
reports under `results/`. There is no server, no user input from a network, no
authentication and no personal data. Two GitHub Actions workflows run the
experiments and commit the results to the repository.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting (the repository's **Security** tab →
**Report a vulnerability**). Do not open a public issue for something that exposes
a secret or a way to run code on CI.

## Security review guidelines

For automated and human security review of pull requests.

### Threat model

- **Assets:** the workflow token, which has `contents: write` and can push to
  the repository; the integrity of the committed results; contributors'
  machines.
- **Trust boundaries:**
  - pull requests from forks, and anything that decides which code the
    write-token workflows run;
  - `workflow_dispatch` inputs (`judge`, `k`, `report_dir`);
  - content downloaded at run time: the Medical Question Pairs CSV, the Ollama
    installer and the models;
  - model output: a judge reply is untrusted text;
  - npm dependencies and the GitHub Actions used by the workflows.
- **Not a boundary:** the Ollama server on `localhost`, and the command-line
  options of someone running the experiments on their own machine.

### Accepted by design; do not report

- Plain HTTP to Ollama on `localhost`, with no authentication.
- No validation of `--host`, `--data` or `--out` beyond what the code does: the
  person running the command chooses them.
- Workflows that commit to the repository. That is how results are published.

### Flag a change that

**Workflows**

- Adds a `pull_request` or `pull_request_target` trigger to a workflow that has
  `contents: write`, or otherwise lets code from a fork run with that token.
- Widens `permissions`, or adds a secret to a job.
- Interpolates `${{ inputs.* }}` or any event field directly into a `run:`
  script. Inputs reach the shell through `env:` and are quoted where used.
- Uses a workflow input to build a path without constraining it. `report_dir`
  ends up in `results/$REPORT_DIR/` for both the report writer and `git add`; a
  value with `..` or a leading `/` must not be able to write or commit outside
  `results/`.
- Broadens what a workflow commits beyond `results/` (`git add -A`, `git add .`),
  or commits a file the `.gitignore` lists.
- Adds another download-and-execute step, or an action from an owner not
  already in use. A step that runs downloaded code must not have the write token
  available to it.
- Removes `[skip ci]` from the result commits or otherwise lets a result commit
  trigger the workflow that produced it.

**Data**

- Commits text from the Medical Question Pairs dataset, in any form: the CSV, a
  sample, a fixture, a report that quotes questions, or a file under
  `results/.annotation/`. The dataset has no licence; it is downloaded at run
  time and reports show aggregates only.
- Changes `MQP_URL` to a host other than the dataset's own repository, or makes
  a workflow download data or code from a new host.
- Commits `results/.embeddings-cache.json` or anything else that could carry
  dataset text.

**Model output and file handling**

- Uses a judge or embedding response for anything other than parsing it as data:
  no `eval`, no shell, no path built from it. An unparseable verdict is a miss.
- Writes model output or dataset text into Markdown, CSV or SVG under `results/`
  without escaping. Those files are rendered on GitHub.
- Adds a runtime dependency. There are none today, so every addition is new
  attack surface and needs a reason.

### Severity

- **High:** code from a fork or from a download running with the write token; a
  secret committed; a workflow input that reaches a shell or escapes `results/`.
- **Medium:** dataset text committed; an unpinned or unexplained supply-chain
  change; unescaped external text in a rendered file.
- Everything listed under "Accepted by design" is not a finding.
