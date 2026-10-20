# HOL benchmark results

Static result archive and browser dashboard for HOL Light benchmarks.

## Layout

Each run lives in a directory named:

```text
<YYYY-MM-DD>-<full HOL Light commit>/
```

A run directory contains the unmodified result JSON files and a
`manifest.json` that gives each report its display label. `runs.json` is the
root index used by the webpage.

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

You can open `index.html` directly. For `file://` pages, the dashboard uses
`embedded-runs.js`, generated from the same indexed JSON reports.

To test the normal hosted behavior, serve the repository with any static HTTP
server:

```bash
cd ~/benchmark-results
python3 -m http.server 8000
```

Then open <http://localhost:8000/>.

The page automatically loads the newest entry in `runs.json` (or its bundled
copy when opened directly). Use the run selector to switch among other runs.

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
3. Add `manifest.json`, following the existing run.
4. Prepend an entry to `runs.json` so the newest run loads by default.
5. Run `./generate-embedded-runs.py` to refresh direct `file://` support.

Keep full commit hashes in both the directory name and JSON provenance fields.
Do not combine the two s2n-bignum reports: their common schema and distinct
`arch` fields let the dashboard display them as variants of one benchmark
family without creating a second aggregate format.
