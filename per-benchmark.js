"use strict";

// Per-benchmark view: the latest official HOL Light runs of every report,
// newest first. Fork runs ("HOL Light (<owner>)") are left out.

const HISTORY_LENGTH = 5;
// Load at most this many of the newest runs. A report that appears in fewer
// runs than HISTORY_LENGTH within them shows what is available.
const SCAN_LIMIT = 20;

const elements = {
  notice: document.querySelector("#notice"),
  history: document.querySelector("#benchmark-history"),
};

const state = {
  runs: [],
  // Run bundles in runs.json order (newest first); a failed load is null.
  bundles: [],
};

function showNotice(message, isError = false) {
  elements.notice.textContent = message;
  elements.notice.className = isError ? "notice error" : "notice";
  elements.notice.hidden = false;
}

function formatDuration(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  const seconds = Number(value);
  if (seconds < 60) return `${seconds.toFixed(seconds % 1 ? 1 : 0)}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m ${secs}s`;
}

// Load the newest runs until every report seen has HISTORY_LENGTH + 1 runs
// (one more than shown, for the change column), or SCAN_LIMIT is reached.
async function loadBundles(runs) {
  const bundles = [];
  const seen = new Map();
  const batchSize = 3;
  for (let start = 0; start < Math.min(runs.length, SCAN_LIMIT); start += batchSize) {
    const batch = runs.slice(start, Math.min(start + batchSize, SCAN_LIMIT));
    const loaded = await Promise.all(batch.map((run) => loadRunBundle(run).catch((error) => {
      showNotice(`Could not load run ${run.id}: ${error.message}`, true);
      return null;
    })));
    for (const bundle of loaded) {
      bundles.push(bundle);
      for (const report of bundle?.reports || []) {
        seen.set(report.label, (seen.get(report.label) || 0) + 1);
      }
    }
    const registered = BENCHMARK_REGISTRY.benchmarks.flatMap((benchmark) => benchmark.reports);
    const labels = new Set([...seen.keys(), ...registered]);
    if ([...labels].every((label) => (seen.get(label) || 0) > HISTORY_LENGTH)) break;
  }
  return bundles;
}

// Benchmarks to show: registry order first, then report labels the registry
// does not know, each as its own group.
function benchmarkGroups(bundles) {
  const labels = [];
  for (const bundle of bundles) {
    for (const report of bundle?.reports || []) {
      if (!labels.includes(report.label)) labels.push(report.label);
    }
  }
  const groups = BENCHMARK_REGISTRY.benchmarks.map((benchmark) => ({
    id: benchmark.id,
    title: benchmark.title,
    reports: benchmark.reports,
    registered: true,
  }));
  for (const label of labels) {
    if (!benchmarkForReport(label)) {
      groups.push({ id: null, title: label, reports: [label], registered: false });
    }
  }
  return groups;
}

// The runs with this report, newest first, each with its report data.
function reportHistory(bundles, label) {
  const history = [];
  for (const bundle of bundles) {
    const report = bundle?.reports.find((entry) => entry.label === label);
    if (report) history.push({ bundle, data: report.data });
  }
  return history;
}

function holLightCell(bundle) {
  const cell = document.createElement("td");
  const manifest = bundle.manifest;
  const hash = manifest.hol_light_commit;
  const source = BENCHMARK_REGISTRY.sources.find((entry) => entry.name === "HOL Light");
  const repository = manifest.repositories?.["HOL Light"] || source?.repository;
  cell.append(document.createTextNode(`${manifest.hol_light_label || "HOL Light"} `));
  if (hash && repository) {
    cell.append(externalLink("commit-link", shortHash(hash), `${repository}/commit/${hash}`, hash));
  } else {
    cell.append(makeElement("span", "commit-link", shortHash(hash)));
  }
  return cell;
}

function runCell(bundle) {
  const cell = makeElement("td", "history-run");
  const link = makeElement("a", "", bundle.manifest.date || bundle.index.date);
  link.href = `runs.html?run=${encodeURIComponent(bundle.index.id)}`;
  link.title = `Full results of ${runLabel(bundle.index)}`;
  cell.append(link);
  return cell;
}

function resultCell(data) {
  const cell = makeElement("td", "history-result");
  for (const status of ["pass", "fail", "skip", "missing"]) {
    const count = Number(data.counts?.[status] || 0);
    if (count) cell.append(statusPill(status, count));
  }
  if (!cell.childNodes.length) cell.textContent = "—";
  return cell;
}

function changeCell(entry, previous) {
  const cell = makeElement("td", "numeric history-change");
  if (!previous) {
    cell.textContent = "—";
    cell.title = "No earlier run with this report";
    return cell;
  }
  const change = reportSpeedChange(previous.data, entry.data);
  const params = new URLSearchParams({
    baseline: previous.bundle.index.id,
    comparison: entry.bundle.index.id,
  });
  const plural = (count) => `${count} test${count === 1 ? "" : "s"}`;
  let text;
  let title;
  if (change.improvement !== null) {
    text = formatSignedPercent(change.improvement);
    title = `${formatRatio(change.ratio)} speed ratio over ${plural(change.counted)}, against ${runLabel(previous.bundle.index)}`;
  } else if (change.withinNoise) {
    text = `within ${TIME_NOISE_SECONDS} s`;
    title = `Every test timed in both runs changed by ${TIME_NOISE_SECONDS} s or less`;
  } else {
    text = "no common timings";
    title = `No test passed with a timing in both this run and ${previous.bundle.index.date}`;
  }
  const link = makeElement(
    "a",
    change.improvement === null ? "perf-same" : performanceClass(change.improvement),
    text,
  );
  link.href = `compare.html?${params}`;
  link.title = title;
  cell.append(link);
  if (change.counted) {
    const detail = change.withinNoise
      ? `${plural(change.counted)} · ${change.withinNoise} within ${TIME_NOISE_SECONDS} s`
      : plural(change.counted);
    cell.append(makeElement("span", "history-detail", detail));
  }
  return cell;
}

function historyTable(label, history) {
  const wrap = makeElement("div", "table-wrap");
  const table = makeElement("table", "history-table");
  const caption = makeElement("caption", "sr-only", `Latest runs of ${label}`);
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const [title, numeric] of [
    ["Run", false], ["HOL Light", false], ["OCaml", false], ["Result", false],
    ["Σ test time", true], ["Change", true],
  ]) {
    const th = makeElement("th", numeric ? "numeric" : "", title);
    th.scope = "col";
    headRow.append(th);
  }
  head.append(headRow);
  const body = document.createElement("tbody");
  history.slice(0, HISTORY_LENGTH).forEach((entry, index) => {
    const row = document.createElement("tr");
    row.append(
      runCell(entry.bundle),
      holLightCell(entry.bundle),
      makeElement("td", "", entry.bundle.manifest.ocaml_version || "—"),
      resultCell(entry.data),
      makeElement("td", "numeric", formatDuration(entry.data.total_elapsed_seconds)),
      changeCell(entry, history[index + 1]),
    );
    body.append(row);
  });
  table.append(caption, head, body);
  wrap.append(table);
  return wrap;
}

function render() {
  const bundles = state.bundles.filter(Boolean);
  const fragment = document.createDocumentFragment();

  for (const group of benchmarkGroups(bundles)) {
    const section = makeElement("section", "history-benchmark");
    const heading = makeElement("div", "section-heading");
    heading.append(makeElement("h2", "", group.title));
    if (group.registered) {
      const about = makeElement("a", "nav-link", "What this measures");
      about.href = `benchmarks.html#${group.id}`;
      heading.append(about);
    }
    section.append(heading);

    for (const label of group.reports) {
      const history = reportHistory(bundles, label);
      if (group.reports.length > 1) section.append(makeElement("h3", "history-report", label));
      if (!history.length) {
        section.append(makeElement("p", "empty-results", "No published run includes this report yet."));
        continue;
      }
      section.append(historyTable(label, history));
    }
    fragment.append(section);
  }

  elements.history.replaceChildren(fragment);
  if (!elements.history.children.length) {
    elements.history.append(makeElement("p", "empty-results", "No official runs have been published yet."));
  }
}

async function initialize() {
  try {
    state.runs = (await fetchRuns()).filter((run) => !runOwner(run));
  } catch (error) {
    elements.history.replaceChildren();
    showNotice(`Could not load runs.json: ${error.message}`, true);
    return;
  }
  state.bundles = await loadBundles(state.runs);
  elements.history.removeAttribute("aria-busy");
  render();
}

initialize();
