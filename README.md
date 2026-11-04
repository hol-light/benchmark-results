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
`benchmark-scripts` commit and OCaml compiler version used for the run, and
maps source names to their repository URLs so commit links work for forks.
`runs.json` is the root index used by the webpage.

A run contains one result file per report listed in its manifest. Benchmarks
added later are simply absent from older runs; s2n-bignum records ARM and x86
as separate reports. A current run looks like this:

```text
<run>/
├── manifest.json
├── hol-light-results.json
├── s2n-bignum-arm-results.json
├── s2n-bignum-x86-results.json
├── flyspeck-results.json
├── navier-stokes-results.json
├── catalan-is-irrational-results.json
└── 4ct-results.json
```

A manifest may also have a `notes` list of strings, shown under the run
heading on the results and comparison pages. Use it to record anything about
how the run was produced that the reports themselves do not show, such as a
report that was re-run or added later.

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

When hosted, the pages use same-origin relative URLs; when opened directly,
they use the raw GitHub URLs above.

## Pages

| Page | Shows |
| --- | --- |
| `index.html` (**Per benchmark**) | For every benchmark report, its latest five official HOL Light runs, newest first: the commit, OCaml version, pass/fail counts, total test time, and the speed change against the previous official run with that report. Fork runs are left out. |
| `runs.html` (**Summary per run**) | All results of one run. It opens the newest official HOL Light run, or the run named by `?run=<run id>`. The run selector lists official results first and groups fork-specific runs below an owner separator. |
| `compare.html` (**Compare runs**) | Test-by-test timing of two runs (below). |
| `benchmarks.html` (**Explain benchmarks**) | What each benchmark measures and what a pass requires. |

Shared helpers live in `common.js`, and everything specific to individual
benchmarks in `benchmarks-registry.js`.

## Compare runs

Open `compare.html` or use **Compare runs** in the page header. Select
a baseline and comparison run to see:

- elapsed time, speed ratio, and faster/slower result for every comparable test,
- geometric-mean improvement for each benchmark and for the full run,
- aggregate elapsed-time ratios, and
- a warning when the OCaml version, CPU model, architecture, or total RAM differs between runs.

The selected run IDs are stored in the URL as `baseline` and `comparison`
query parameters. Copying the browser URL therefore shares the same comparison.

Tests contribute to averages only when they passed and have positive elapsed
times in both runs. Benchmark sections and test rows default to descending
speedup. Click any table heading to sort by that column or reverse its order.
Benchmark sections are collapsed by default, and the **Slower only** filter
isolates regressions.

## Add a benchmark

The pages show whatever reports a run's manifest lists, so a new benchmark
needs no page changes to appear in results and comparisons. Its description,
its summary-card link, and its source-commit link come from one file,
`benchmarks-registry.js`:

1. Add the benchmark's repository to `sources`, with the report field that
   holds its commit (for example, `catalan_is_irrational_commit`).
2. Add an entry to `benchmarks` with an `id`, a `title`, the manifest report
   labels it covers (`reports`), its `description`, and its `passCriteria`.
   The entry becomes a section of `benchmarks.html`.

## Publish with GitHub Pages

This repository has no build step. In the GitHub repository settings:

1. Open **Pages**.
2. Select **Deploy from a branch**.
3. Select the branch containing these files and the `/ (root)` directory.
4. Save.

GitHub Pages will serve `index.html`, which loads `runs.json`, the recent runs'
manifests, and their report files with relative URLs.

## Add another run

1. Create `<date>-<hol-light-commit>/`.
2. Copy the result JSON files into it.
3. Add `manifest.json`, following the existing run, including the full
   `benchmark_scripts_commit` and `ocaml_version` that produced the reports. For forked HOL Light
   runs, set `hol_light_label` (for example, `HOL Light (aqjune-aws)`) and the
   matching `repositories["HOL Light"]` URL.
4. Prepend an entry to `runs.json` with the same `hol_light_label` and
   `ocaml_version` so the newest run loads by default.

Keep full commit hashes in both the directory name and JSON provenance fields.
Do not combine the two s2n-bignum reports: their common schema and distinct
`arch` fields let the dashboard display them as variants of one benchmark
family without creating a second aggregate format.

