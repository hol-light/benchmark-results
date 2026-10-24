"use strict";

const remoteResultsRoot = new URL(
  "https://raw.githubusercontent.com/hol-light/benchmark-results/main/",
);
const resultsRoot = window.location.protocol === "file:"
  ? remoteResultsRoot
  : new URL("./", window.location.href);

const elements = {
  baseline: document.querySelector("#baseline-run"),
  candidate: document.querySelector("#candidate-run"),
  swap: document.querySelector("#swap-runs"),
  notice: document.querySelector("#compare-notice"),
  comparison: document.querySelector("#comparison"),
  empty: document.querySelector("#compare-empty"),
  heading: document.querySelector("#comparison-heading"),
  environmentWarning: document.querySelector("#environment-warning"),
  overall: document.querySelector("#comparison-overall"),
  benchmarks: document.querySelector("#benchmark-comparisons"),
  search: document.querySelector("#compare-search"),
  regressionsOnly: document.querySelector("#regressions-only"),
};

const state = {
  runs: [],
  baseline: null,
  candidate: null,
  comparisons: [],
  cache: new Map(),
  sortBySuite: new Map(),
  openSuites: new Set(),
};

function makeElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function shortHash(hash) {
  return hash ? hash.slice(0, 10) : "unknown";
}

function runLabel(run) {
  return `${run.date} · ${run.hol_light_label || "HOL Light"} ${shortHash(run.hol_light_commit)}`;
}

function formatDuration(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  const seconds = Number(value);
  if (seconds < 60) return `${seconds.toFixed(seconds % 1 ? 2 : 0)}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);
  return hours ? `${hours}h ${minutes}m ${secs}s` : `${minutes}m ${secs}s`;
}

function formatRatio(ratio) {
  return Number.isFinite(ratio) ? `${ratio.toFixed(3)}×` : "—";
}

function improvementFromRatio(ratio) {
  return (1 - 1 / ratio) * 100;
}

function formatSignedPercent(value) {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

function performanceClass(improvement) {
  if (improvement > 0.05) return "perf-faster";
  if (improvement < -0.05) return "perf-slower";
  return "perf-same";
}

function verdict(improvement) {
  if (improvement > 0.05) return `${improvement.toFixed(2)}% faster`;
  if (improvement < -0.05) return `${Math.abs(improvement).toFixed(2)}% slower`;
  return "No material change";
}

function geometricMean(values) {
  if (!values.length) return null;
  return Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length);
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

function showNotice(message, isError = false) {
  elements.notice.textContent = message;
  elements.notice.className = isError ? "notice error" : "notice";
  elements.notice.hidden = false;
}

function clearNotice() {
  elements.notice.hidden = true;
  elements.notice.textContent = "";
}

async function loadBundle(run) {
  if (state.cache.has(run.id)) return state.cache.get(run.id);

  const manifestUrl = new URL(run.manifest, resultsRoot);
  const manifest = await fetchJson(manifestUrl);
  const baseUrl = new URL("./", manifestUrl);
  const reports = await Promise.all(manifest.reports.map(async (entry) => ({
    label: entry.label,
    fileName: entry.file,
    data: await fetchJson(new URL(entry.file, baseUrl)),
  })));
  const bundle = { index: run, manifest, reports };
  state.cache.set(run.id, bundle);
  return bundle;
}

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

function compareReport(label, baselineReport, candidateReport) {
  const baselineTests = new Map(
    (baselineReport?.data.tests || []).map((test) => [test.name, test]),
  );
  const candidateTests = new Map(
    (candidateReport?.data.tests || []).map((test) => [test.name, test]),
  );
  const names = [...new Set([...baselineTests.keys(), ...candidateTests.keys()])].sort();
  const rows = names.map((name) => {
    const baseline = baselineTests.get(name);
    const candidate = candidateTests.get(name);
    if (!comparableTest(baseline, candidate)) {
      return {
        name,
        baseline,
        candidate,
        comparable: false,
        reason: `${baseline?.status || "absent"} → ${candidate?.status || "absent"}`,
      };
    }
    const baselineSeconds = Number(baseline.elapsed_seconds);
    const candidateSeconds = Number(candidate.elapsed_seconds);
    const ratio = baselineSeconds / candidateSeconds;
    const improvement = improvementFromRatio(ratio);
    return {
      name,
      baseline,
      candidate,
      comparable: true,
      baselineSeconds,
      candidateSeconds,
      ratio,
      improvement,
    };
  });
  const comparable = rows.filter((row) => row.comparable);
  const ratio = geometricMean(comparable.map((row) => row.ratio));
  return {
    label,
    rows,
    comparable,
    ratio,
    improvement: ratio === null ? null : improvementFromRatio(ratio),
    baselineTotal: comparable.reduce((sum, row) => sum + row.baselineSeconds, 0),
    candidateTotal: comparable.reduce((sum, row) => sum + row.candidateSeconds, 0),
    faster: comparable.filter((row) => row.improvement > 0.05).length,
    slower: comparable.filter((row) => row.improvement < -0.05).length,
    same: comparable.filter((row) => Math.abs(row.improvement) <= 0.05).length,
  };
}

function buildComparisons(baselineBundle, candidateBundle) {
  const labels = [...new Set([
    ...baselineBundle.reports.map((report) => report.label),
    ...candidateBundle.reports.map((report) => report.label),
  ])];
  return labels.map((label) => compareReport(
    label,
    baselineBundle.reports.find((report) => report.label === label),
    candidateBundle.reports.find((report) => report.label === label),
  ));
}

function commitLink(bundle) {
  const hash = bundle.manifest.hol_light_commit;
  const repository = bundle.manifest.repositories?.["HOL Light"];
  const link = makeElement("a", "commit-link", shortHash(hash));
  link.href = repository ? `${repository}/commit/${hash}` : "#";
  link.title = hash;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function renderHeading() {
  elements.heading.replaceChildren();
  const baseline = makeElement("div", "comparison-run");
  baseline.append(makeElement("span", "comparison-label", "Baseline"), commitLink(state.baseline));
  const arrow = makeElement("span", "comparison-arrow", "→");
  const candidate = makeElement("div", "comparison-run");
  candidate.append(makeElement("span", "comparison-label", "Comparison"), commitLink(state.candidate));
  elements.heading.append(baseline, arrow, candidate);
}

function machineForRun(bundle) {
  return bundle.reports.find((report) => report.data.machine)?.data.machine || {};
}

function formatMemory(machine) {
  if (machine.memory_total_gib !== null && machine.memory_total_gib !== undefined) {
    return `${machine.memory_total_gib} GiB`;
  }
  return machine.memory_total_bytes ?? "unknown";
}

function renderEnvironmentWarning() {
  const baseline = machineForRun(state.baseline);
  const candidate = machineForRun(state.candidate);
  const differences = [];

  if (baseline.cpu_brand !== candidate.cpu_brand) {
    differences.push(`CPU: ${baseline.cpu_brand || "unknown"} → ${candidate.cpu_brand || "unknown"}`);
  }
  if (baseline.architecture !== candidate.architecture) {
    differences.push(`architecture: ${baseline.architecture || "unknown"} → ${candidate.architecture || "unknown"}`);
  }
  if (baseline.memory_total_bytes !== candidate.memory_total_bytes) {
    differences.push(`RAM: ${formatMemory(baseline)} → ${formatMemory(candidate)}`);
  }

  elements.environmentWarning.replaceChildren();
  if (!differences.length) {
    elements.environmentWarning.hidden = true;
    return;
  }

  elements.environmentWarning.append(
    makeElement("strong", "", "Different run environments. "),
    document.createTextNode(`${differences.join("; ")}. Performance results may not be directly comparable.`),
  );
  elements.environmentWarning.hidden = false;
}

function metricCard(label, value, detail, className = "") {
  const card = makeElement("div", `metric-card ${className}`.trim());
  card.append(
    makeElement("span", "metric-label", label),
    makeElement("strong", "metric-value", value),
    makeElement("span", "metric-detail", detail),
  );
  return card;
}

function renderOverall() {
  elements.overall.replaceChildren();
  const comparable = state.comparisons.flatMap((comparison) => comparison.comparable);
  const ratio = geometricMean(comparable.map((row) => row.ratio));
  const improvement = ratio === null ? null : improvementFromRatio(ratio);
  const faster = comparable.filter((row) => row.improvement > 0.05).length;
  const slower = comparable.filter((row) => row.improvement < -0.05).length;
  const baselineTotal = comparable.reduce((sum, row) => sum + row.baselineSeconds, 0);
  const candidateTotal = comparable.reduce((sum, row) => sum + row.candidateSeconds, 0);
  const aggregateRatio = candidateTotal > 0 ? baselineTotal / candidateTotal : null;

  elements.overall.append(
    metricCard(
      "Average improvement",
      improvement === null ? "—" : formatSignedPercent(improvement),
      "Geometric mean across comparable tests",
      improvement === null ? "" : performanceClass(improvement),
    ),
    metricCard(
      "Geometric mean speed ratio",
      ratio === null ? "—" : formatRatio(ratio),
      "Above 1.0× means the comparison is faster",
      improvement === null ? "" : performanceClass(improvement),
    ),
    metricCard(
      "Comparable tests",
      comparable.length.toLocaleString(),
      `${faster} faster · ${slower} slower`,
    ),
    metricCard(
      "Aggregate time ratio",
      aggregateRatio === null ? "—" : formatRatio(aggregateRatio),
      `${formatDuration(baselineTotal)} → ${formatDuration(candidateTotal)}`,
      aggregateRatio === null ? "" : performanceClass(improvementFromRatio(aggregateRatio)),
    ),
  );
}

function makeComparisonRow(row) {
  const tr = document.createElement("tr");
  tr.append(makeElement("td", "test-name", row.name));
  tr.append(makeElement("td", "numeric", formatDuration(row.baseline?.elapsed_seconds)));
  tr.append(makeElement("td", "numeric", formatDuration(row.candidate?.elapsed_seconds)));
  if (row.comparable) {
    const className = performanceClass(row.improvement);
    tr.append(makeElement("td", `numeric ${className}`, formatSignedPercent(row.improvement)));
    tr.append(makeElement("td", `numeric ${className}`, formatRatio(row.ratio)));
    tr.append(makeElement("td", className, verdict(row.improvement)));
  } else {
    tr.className = "not-comparable";
    tr.append(makeElement("td", "numeric", "—"));
    tr.append(makeElement("td", "numeric", "—"));
    tr.append(makeElement("td", "", row.reason));
  }
  return tr;
}

function sortValue(row, key) {
  if (key === "name") return row.name;
  if (key === "baseline") return row.comparable ? row.baselineSeconds : null;
  if (key === "candidate") return row.comparable ? row.candidateSeconds : null;
  if (key === "improvement") return row.comparable ? row.improvement : null;
  if (key === "ratio") return row.comparable ? row.ratio : null;
  if (key === "result") return row.comparable ? verdict(row.improvement) : row.reason;
  return null;
}

function sortedRows(rows, sort) {
  return [...rows].sort((left, right) => {
    const leftValue = sortValue(left, sort.key);
    const rightValue = sortValue(right, sort.key);
    const leftMissing = leftValue === null || leftValue === undefined;
    const rightMissing = rightValue === null || rightValue === undefined;
    if (leftMissing !== rightMissing) return leftMissing ? 1 : -1;
    if (leftMissing && rightMissing) return left.name.localeCompare(right.name);

    let order;
    if (typeof leftValue === "number" && typeof rightValue === "number") {
      order = leftValue - rightValue;
    } else {
      order = String(leftValue).localeCompare(String(rightValue));
    }
    if (order === 0) order = left.name.localeCompare(right.name);
    return sort.direction === "asc" ? order : -order;
  });
}

function sortableHeader(title, key, numeric, comparison) {
  const current = state.sortBySuite.get(comparison.label) || {
    key: "ratio",
    direction: "desc",
  };
  const active = current.key === key;
  const th = makeElement("th", numeric ? "numeric" : "");
  th.setAttribute(
    "aria-sort",
    active ? (current.direction === "asc" ? "ascending" : "descending") : "none",
  );
  const button = makeElement(
    "button",
    `sort-button${active ? ` active sort-${current.direction}` : ""}`,
    title,
  );
  button.type = "button";
  button.setAttribute(
    "aria-label",
    active
      ? `${title}, sorted ${current.direction === "asc" ? "ascending" : "descending"}`
      : `${title}, not currently sorted`,
  );
  button.append(makeElement("span", "sort-indicator"));
  button.addEventListener("click", () => {
    const previous = state.sortBySuite.get(comparison.label) || {
      key: "ratio",
      direction: "desc",
    };
    const defaultDirection = ["name", "result"].includes(key) ? "asc" : "desc";
    state.sortBySuite.set(comparison.label, {
      key,
      direction: previous.key === key
        ? (previous.direction === "asc" ? "desc" : "asc")
        : defaultDirection,
    });
    state.openSuites.add(comparison.label);
    renderBenchmarks();
  });
  th.append(button);
  return th;
}

function renderBenchmarks() {
  elements.benchmarks.replaceChildren();
  const query = elements.search.value.trim().toLowerCase();
  const slowerOnly = elements.regressionsOnly.checked;

  const comparisons = [...state.comparisons].sort((left, right) => {
    if (left.ratio === null) return 1;
    if (right.ratio === null) return -1;
    return right.ratio - left.ratio;
  });

  for (const comparison of comparisons) {
    const filteredRows = comparison.rows.filter((row) => {
      if (query && !`${comparison.label} ${row.name}`.toLowerCase().includes(query)) return false;
      if (slowerOnly && (!row.comparable || row.improvement >= -0.05)) return false;
      return true;
    });
    const sort = state.sortBySuite.get(comparison.label) || {
      key: "ratio",
      direction: "desc",
    };
    const rows = sortedRows(filteredRows, sort);
    if (!rows.length) continue;

    const details = makeElement("details", "comparison-suite");
    details.open = Boolean(query) || slowerOnly || state.openSuites.has(comparison.label);
    details.addEventListener("toggle", () => {
      if (query || slowerOnly) return;
      if (details.open) state.openSuites.add(comparison.label);
      else state.openSuites.delete(comparison.label);
    });
    const summary = document.createElement("summary");
    const summaryMain = makeElement("span", "comparison-summary-main");
    summaryMain.append(
      makeElement("strong", "", comparison.label),
      makeElement("span", "", `${comparison.comparable.length} comparable tests`),
    );
    const summaryMetric = makeElement(
      "span",
      `comparison-summary-metric ${comparison.improvement === null ? "" : performanceClass(comparison.improvement)}`,
      comparison.improvement === null
        ? "No comparable timing"
        : `${formatSignedPercent(comparison.improvement)} average · ${formatRatio(comparison.ratio)}`,
    );
    summary.append(summaryMain, summaryMetric);
    details.append(summary);

    const stats = makeElement("div", "comparison-suite-stats");
    stats.append(
      makeElement("span", "", `${comparison.faster} faster`),
      makeElement("span", "", `${comparison.slower} slower`),
      makeElement("span", "", `${comparison.same} unchanged`),
      makeElement("span", "", `Aggregate: ${formatDuration(comparison.baselineTotal)} → ${formatDuration(comparison.candidateTotal)}`),
    );
    details.append(stats);

    const tableWrap = makeElement("div", "table-wrap comparison-table-wrap");
    const table = document.createElement("table");
    table.className = "comparison-table";
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const [title, key, numeric] of [
      ["Test", "name", false],
      ["Baseline", "baseline", true],
      ["Comparison", "candidate", true],
      ["Time saved", "improvement", true],
      ["Speed ratio", "ratio", true],
      ["Result", "result", false],
    ]) {
      headRow.append(sortableHeader(title, key, numeric, comparison));
    }
    thead.append(headRow);
    const tbody = document.createElement("tbody");
    for (const row of rows) tbody.append(makeComparisonRow(row));
    table.append(thead, tbody);
    tableWrap.append(table);
    details.append(tableWrap);
    elements.benchmarks.append(details);
  }

  if (!elements.benchmarks.children.length) {
    elements.benchmarks.append(makeElement("div", "empty-results", "No results match the current filters."));
  }
}

function renderComparison() {
  state.comparisons = buildComparisons(state.baseline, state.candidate);
  elements.empty.hidden = true;
  elements.comparison.hidden = false;
  renderHeading();
  renderEnvironmentWarning();
  renderOverall();
  renderBenchmarks();
}

function updateComparisonUrl(baselineId, candidateId) {
  const url = new URL(window.location.href);
  url.searchParams.set("baseline", baselineId);
  url.searchParams.set("comparison", candidateId);
  window.history.replaceState(null, "", url);
  document.title = `${shortHash(baselineId.split("-").at(-1))} vs ${shortHash(candidateId.split("-").at(-1))} · HOL benchmark comparison`;
}

async function compareSelected() {
  clearNotice();
  const baselineId = elements.baseline.value;
  const candidateId = elements.candidate.value;
  if (!baselineId || !candidateId) return;
  if (baselineId === candidateId) {
    elements.comparison.hidden = true;
    elements.empty.hidden = false;
    showNotice("Choose two different runs.", true);
    return;
  }

  elements.baseline.disabled = true;
  elements.candidate.disabled = true;
  elements.swap.disabled = true;
  try {
    const baselineRun = state.runs.find((run) => run.id === baselineId);
    const candidateRun = state.runs.find((run) => run.id === candidateId);
    if (!baselineRun || !candidateRun) {
      throw new Error("The URL names a run that is not present in runs.json");
    }
    updateComparisonUrl(baselineId, candidateId);
    [state.baseline, state.candidate] = await Promise.all([
      loadBundle(baselineRun),
      loadBundle(candidateRun),
    ]);
    state.sortBySuite.clear();
    state.openSuites.clear();
    renderComparison();
  } catch (error) {
    showNotice(`Could not compare runs: ${error.message}`, true);
  } finally {
    elements.baseline.disabled = false;
    elements.candidate.disabled = false;
    elements.swap.disabled = false;
  }
}

function populateSelectors(runs) {
  for (const select of [elements.baseline, elements.candidate]) {
    select.replaceChildren();
    for (const run of runs) select.add(new Option(runLabel(run), run.id));
    select.disabled = false;
  }
  elements.swap.disabled = runs.length < 2;
  if (runs.length >= 2) {
    const params = new URL(window.location.href).searchParams;
    const requestedBaseline = params.get("baseline");
    const requestedCandidate = params.get("comparison");
    const validIds = new Set(runs.map((run) => run.id));
    const baselineId = validIds.has(requestedBaseline) ? requestedBaseline : runs[1].id;
    const candidateId = validIds.has(requestedCandidate) ? requestedCandidate : runs[0].id;

    if (baselineId !== candidateId) {
      elements.baseline.value = baselineId;
      elements.candidate.value = candidateId;
    } else {
      elements.baseline.value = runs[1].id;
      elements.candidate.value = runs[0].id;
    }
  }
}

async function initialize() {
  try {
    state.runs = (await fetchJson(new URL("runs.json", resultsRoot))).runs || [];
  } catch (error) {
    state.runs = [];
    showNotice(`Could not load runs.json: ${error.message}`, true);
  }

  populateSelectors(state.runs);
  if (state.runs.length >= 2) {
    await compareSelected();
  } else {
    elements.empty.hidden = false;
  }
}

elements.baseline.addEventListener("change", compareSelected);
elements.candidate.addEventListener("change", compareSelected);
elements.swap.addEventListener("click", () => {
  const baseline = elements.baseline.value;
  elements.baseline.value = elements.candidate.value;
  elements.candidate.value = baseline;
  compareSelected();
});
elements.search.addEventListener("input", renderBenchmarks);
elements.regressionsOnly.addEventListener("change", renderBenchmarks);

initialize();
