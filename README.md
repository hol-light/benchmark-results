# HOL benchmark results

Static result archive and browser dashboard for HOL Light benchmarks.

To reproduce the reports, see the
[HOL benchmark scripts](https://github.com/hol-light-family/benchmark-scripts/).

## Layout

Each run lives in a directory named:

```text
<YYYY-MM-DD>-<full HOL Light commit>/
```

A run directory contains the unmodified result JSON files and a
`manifest.json` that gives each report its display label, records the exact
`benchmark-scripts` commit used for the run, and maps source names to their
repository URLs so commit links work for forks. `runs.json` is the root index
used by the webpage.

The 2026-10-20 run has four benchmark families but five physical reports,
because s2n-bignum records ARM and x86 separately:

```text
2026-10-20-d30e8239887b2348a063f82232a864de1cc2df15/
├── manifest.json
├── hol-light-results.json
├── s2n-bignum-arm-results.json
├── s2n-bignum-x86-results.json
├── flyspeck-results.json
└── 4ct-results.json
```

## View locally

You can open `index.html` directly. For `file://` pages, the dashboard loads
`runs.json`, manifests, and reports from:

```text
https://raw.githubusercontent.com/hol-light/benchmark-results/main/
```

This requires network access and shows data already pushed to `main`. To test
uncommitted local changes, serve the repository with any static HTTP server:

```bash
cd ~/benchmark-results
python3 -m http.server 8000
```

Then open <http://localhost:8000/>.

The page automatically loads the newest entry in `runs.json`. When hosted, it
uses same-origin relative URLs; when opened directly, it uses the raw GitHub
URLs above. Use the run selector to switch among other runs.

## Compare runs

Open `compare.html` or use **Compare runs** in the results page header. Select
a baseline and comparison run to see:

- elapsed time, speed ratio, and faster/slower result for every comparable test,
- geometric-mean improvement for each benchmark and for the full run,
- aggregate elapsed-time ratios, and
- a warning when CPU model, architecture, or total RAM differs between runs.

Tests contribute to averages only when they passed and have positive elapsed
times in both runs. Benchmark sections and test rows default to descending
speedup. Click any table heading to sort by that column or reverse its order.
Benchmark sections are collapsed by default, and the **Slower only** filter
isolates regressions.

## Publish with GitHub Pages

This repository has no build step. In the GitHub repository settings:

1. Open **Pages**.
2. Select **Deploy from a branch**.
3. Select the branch containing these files and the `/ (root)` directory.
4. Save.

GitHub Pages will serve `index.html`, which loads `runs.json`, each selected
run's manifest, and its report files with relative URLs.

## Add another run

1. Create `<date>-<hol-light-commit>/`.
2. Copy the result JSON files into it.
3. Add `manifest.json`, following the existing run, including the full
   `benchmark_scripts_commit` that produced the reports. For forked HOL Light
   runs, set `hol_light_label` (for example, `HOL Light (aqjune-aws)`) and the
   matching `repositories["HOL Light"]` URL.
4. Prepend an entry to `runs.json` with the same `hol_light_label` so the
   newest run loads by default.

Keep full commit hashes in both the directory name and JSON provenance fields.
Do not combine the two s2n-bignum reports: their common schema and distinct
`arch` fields let the dashboard display them as variants of one benchmark
family without creating a second aggregate format.
