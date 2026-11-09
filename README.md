# Autoresearch: the interactive technical report

**[Read the published report](https://rahul-sarvam.github.io/autoresearch-report/)**

A visual synthesis of five epochs of hybrid language-model research. The site
includes explorable architecture diagrams, recorded training curves, quality
comparisons, context-length curves, passkey depth results and compute accounting.
The research closed on 13 October 2026; publication adds no experiment.

The page is plain HTML, CSS and JavaScript with local fonts and figure data.
There are no runtime services, tracking scripts or external font requests.
The complete report is available as `report.pdf`, `report.html` and `report.md`.
Original evidence links require access to the private research repository.

## Rebuild in the research repository

```sh
python3 tech_report/build_project_report.py --date "9 November 2026"
python3 scripts/build_project_site.py
python3 -m unittest discover -s scripts -p 'test_project_site*.py'
python3 -m unittest discover -s tech_report -p test_report_build.py
python3 -m http.server 8765 --bind 127.0.0.1 --directory site
```

The PDF builder uses the repository's pinned Tectonic executable. The site
preparation script extracts observations from the saved evidence, verifies
report build hashes, and stages portable report downloads. No GPU or model
checkpoint is needed. Training points are selected without smoothing; all
validation points are retained. Historical numerical tables are reviewed
against the corrected epoch reports rather than reinterpreted from old plots.

## Publication

This directory is the complete public artifact. Copy its contents, including
`.nojekyll` and font licenses, to the `main` branch of
[`rahul-sarvam/autoresearch-report`](https://github.com/rahul-sarvam/autoresearch-report).
GitHub Pages serves that branch's repository root. Use relative asset URLs so
the site also works under `/autoresearch-report/`.

The separate public repository hosts only this presentation and its downloads;
the research repository remains private. Do not copy the research repository,
checkpoints, corpora, launch logs or local authentication files into it.

Before publishing a revision, check desktop and mobile layouts, keyboard
controls, chart values and downloads in a browser. Preserve the distinction
between historical 64K-trained endpoints and fresh 4K-trained models, and keep
both failed cache checks visible. No model-quality ranking or serving-speed
claim may be inferred from presentation changes.
