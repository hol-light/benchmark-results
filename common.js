"use strict";

// Helpers shared by the dashboard pages. Load after benchmarks-registry.js
// (when a page uses it) and before the page's own script.

const remoteResultsRoot = new URL(
  "https://raw.githubusercontent.com/hol-light/benchmark-results/main/",
);
const resultsRoot = window.location.protocol === "file:"
  ? remoteResultsRoot
  : new URL("./", window.location.href);

function makeElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function shortHash(hash) {
  return hash ? hash.slice(0, 10) : "unknown";
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function fetchRuns() {
  return (await fetchJson(new URL("runs.json", resultsRoot))).runs || [];
}

// The fork owner of a run labelled "HOL Light (<owner>)", or null for an
// official HOL Light run.
function runOwner(run) {
  const match = String(run.hol_light_label || "").match(/^HOL Light \(([^)]+)\)$/);
  return match ? match[1] : null;
}

function runLabel(run) {
  const compiler = run.ocaml_version ? ` · OCaml ${run.ocaml_version}` : "";
  return `${run.date} · ${run.hol_light_label || "HOL Light"} ${shortHash(run.hol_light_commit)}${compiler}`;
}

// A run's manifest and report files, cached by run id:
// { index: <runs.json entry>, manifest, reports: [{ label, fileName, data }] }.
const runBundleCache = new Map();

function loadRunBundle(run) {
  if (!runBundleCache.has(run.id)) {
    const load = (async () => {
      const manifestUrl = new URL(run.manifest, resultsRoot);
      const manifest = await fetchJson(manifestUrl);
      const baseUrl = new URL("./", manifestUrl);
      const reports = await Promise.all(manifest.reports.map(async (entry) => ({
        label: entry.label,
        fileName: entry.file,
        data: await fetchJson(new URL(entry.file, baseUrl)),
      })));
      return { index: run, manifest, reports };
    })();
    // Do not cache failures, so a later attempt can retry.
    load.catch(() => runBundleCache.delete(run.id));
    runBundleCache.set(run.id, load);
  }
  return runBundleCache.get(run.id);
}

function externalLink(className, text, href, title) {
  const link = makeElement("a", className, text);
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  if (title) link.title = title;
  return link;
}

// A test is timed against another only if it passed with a positive elapsed
// time in both runs.
function comparableTest(baseline, candidate) {
  const baselineTime = Number(baseline?.elapsed_seconds);
  const candidateTime = Number(candidate?.elapsed_seconds);
  return baseline?.status === "pass"
    && candidate?.status === "pass"
    && Number.isFinite(baselineTime)
    && Number.isFinite(candidateTime)
    && baselineTime > 0
    && candidateTime > 0;
}

// Timing changes of at most this many seconds are treated as noise: such a
// test counts as unchanged and is left out of speed averages.
const TIME_NOISE_SECONDS = 3;

function timeChangeIsSignificant(baselineSeconds, candidateSeconds) {
  return Math.abs(candidateSeconds - baselineSeconds) > TIME_NOISE_SECONDS;
}

function geometricMean(values) {
  if (!values.length) return null;
  return Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length);
}

// Speed ratio is baseline time / comparison time; improvement is the
// percentage of baseline time saved.
function improvementFromRatio(ratio) {
  return (1 - 1 / ratio) * 100;
}

// Geometric-mean speed ratio of one report against another, over the tests
// comparable in both whose time changed by more than TIME_NOISE_SECONDS:
// { ratio, improvement, counted, withinNoise }. counted is the number of
// tests in the average, withinNoise the comparable tests left out; ratio and
// improvement are null when no test is counted.
function reportSpeedChange(baselineData, candidateData) {
  const baselineTests = new Map((baselineData?.tests || []).map((test) => [test.name, test]));
  const ratios = [];
  let withinNoise = 0;
  for (const test of candidateData?.tests || []) {
    const baseline = baselineTests.get(test.name);
    if (!comparableTest(baseline, test)) continue;
    const baselineSeconds = Number(baseline.elapsed_seconds);
    const candidateSeconds = Number(test.elapsed_seconds);
    if (timeChangeIsSignificant(baselineSeconds, candidateSeconds)) {
      ratios.push(baselineSeconds / candidateSeconds);
    } else {
      withinNoise += 1;
    }
  }
  const ratio = geometricMean(ratios);
  return {
    ratio,
    improvement: ratio === null ? null : improvementFromRatio(ratio),
    counted: ratios.length,
    withinNoise,
  };
}

function formatRatio(ratio) {
  return Number.isFinite(ratio) ? `${ratio.toFixed(3)}×` : "—";
}

function formatSignedPercent(value) {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

// Changes within ±0.05% are treated as no change.
function performanceClass(improvement) {
  if (improvement > 0.05) return "perf-faster";
  if (improvement < -0.05) return "perf-slower";
  return "perf-same";
}

function statusPill(status, count) {
  const pill = makeElement("span", `status-pill status-${status}`);
  pill.textContent = count === undefined ? status : `${count} ${status}`;
  return pill;
}
