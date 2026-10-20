"use strict";

const state = {
  reports: [],
  manifest: null,
  collapsedSuites: new Set(),
};

const embeddedRuns = Array.isArray(window.BENCHMARK_EMBEDDED_RUNS)
  ? window.BENCHMARK_EMBEDDED_RUNS
  : [];

const sourceRepositories = {
  "HOL Light": "https://github.com/jrh13/hol-light",
  "s2n-bignum": "https://github.com/awslabs/s2n-bignum",
  "Flyspeck": "https://github.com/hol-light-family/Flyspeck",
  "benchmark-scripts": "https://github.com/hol-light-family/benchmark-scripts",
};

const elements = {
  runSelect: document.querySelector("#run-select"),
  notice: document.querySelector("#notice"),
  dashboard: document.querySelector("#dashboard"),
  emptyState: document.querySelector("#empty-state"),
  runHeading: document.querySelector("#run-heading"),
  metadata: document.querySelector("#metadata"),
  summaryCards: document.querySelector("#summary-cards"),
  overall: document.querySelector("#overall"),
  search: document.querySelector("#search"),
  statusFilter: document.querySelector("#status-filter"),
  expandAll: document.querySelector("#expand-all"),
  collapseAll: document.querySelector("#collapse-all"),
  resultsBody: document.querySelector("#results-body"),
  emptyResults: document.querySelector("#empty-results"),
  resultCount: document.querySelector("#result-count"),
};

function makeElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
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

function shortHash(hash) {
  return hash ? hash.slice(0, 10) : "unknown";
}

function formatDuration(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const seconds = Number(value);
  if (seconds < 60) return `${seconds.toFixed(seconds % 1 ? 1 : 0)}s`;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);
  if (days) return `${days}d ${hours}h ${minutes}m`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m ${secs}s`;
}

function statusPill(status, count) {
  const pill = makeElement("span", `status-pill status-${status}`);
  pill.textContent = count === undefined ? status : `${count} ${status}`;
  return pill;
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

function resetCollapsedSuites() {
  state.collapsedSuites = new Set(
    state.reports
      .filter(({ data }) => !data.counts?.fail && !data.counts?.missing)
      .map(({ label }) => label),
  );
}

function loadEmbeddedRun(runId) {
  const bundled = embeddedRuns.find((run) => run.index.id === runId);
  if (!bundled) {
    showNotice(`Bundled run not found: ${runId}`, true);
    return;
  }
  clearNotice();
  state.manifest = bundled.manifest;
  state.reports = bundled.reports;
  resetCollapsedSuites();
  render();
}

function populateRunSelect(runs, valueForRun) {
  elements.runSelect.replaceChildren(new Option("Choose a published run…", ""));
  for (const run of runs) {
    const label = `${run.date} · HOL Light ${shortHash(run.hol_light_commit)}`;
    elements.runSelect.add(new Option(label, valueForRun(run)));
  }
  elements.runSelect.disabled = false;
}

async function loadPublishedRun(manifestPath) {
  clearNotice();
  elements.runSelect.disabled = true;
  try {
    const manifestUrl = new URL(manifestPath, window.location.href);
    const manifest = await fetchJson(manifestUrl);
    const baseUrl = new URL("./", manifestUrl);
    const reports = await Promise.all(manifest.reports.map(async (entry) => ({
      label: entry.label,
      fileName: entry.file,
      data: await fetchJson(new URL(entry.file, baseUrl)),
    })));
    state.manifest = manifest;
    state.reports = reports;
    resetCollapsedSuites();
    render();
  } catch (error) {
    showNotice(`Could not load the published run: ${error.message}`, true);
  } finally {
    elements.runSelect.disabled = false;
  }
}

function renderMetadata() {
  elements.metadata.replaceChildren();
  const first = state.reports[0]?.data || {};
  const machine = first.machine || {};
  const commits = new Map();
  for (const { data } of state.reports) {
    if (data.hol_light_commit) commits.set("HOL Light", data.hol_light_commit);
    if (data.s2n_bignum_commit) commits.set("s2n-bignum", data.s2n_bignum_commit);
    if (data.flyspeck_commit) commits.set("Flyspeck", data.flyspeck_commit);
  }
  if (state.manifest?.benchmark_scripts_commit) {
    commits.set("benchmark-scripts", state.manifest.benchmark_scripts_commit);
  }

  const memory = machine.memory_total_gib !== null && machine.memory_total_gib !== undefined
    ? `${machine.memory_total_gib} GiB`
    : "Unknown";
  const items = [
    ["Processor", machine.cpu_brand || "Unknown"],
    ["Architecture / cores", `${machine.architecture || "unknown"} · ${machine.num_cores ?? "?"} online`],
    ["Memory", memory],
  ];
  for (const [label, value] of items) {
    const item = makeElement("div", "meta-item");
    item.append(
      makeElement("span", "meta-label", label),
      makeElement("span", "meta-value", value),
    );
    elements.metadata.append(item);
  }

  const sourceItem = makeElement("div", "meta-item");
  sourceItem.append(makeElement("span", "meta-label", "Source commits"));
  const commitList = makeElement("ul", "commit-list");
  for (const [name, hash] of commits) {
    const repository = sourceRepositories[name];
    const row = document.createElement("li");
    const repoLink = makeElement("a", "repo-link", name);
    repoLink.href = repository;
    repoLink.target = "_blank";
    repoLink.rel = "noopener noreferrer";
    const commitLink = makeElement("a", "commit-link", shortHash(hash));
    commitLink.href = `${repository}/commit/${hash}`;
    commitLink.target = "_blank";
    commitLink.rel = "noopener noreferrer";
    commitLink.title = hash;
    row.append(repoLink, document.createTextNode(" @ "), commitLink);
    commitList.append(row);
  }
  if (!commits.size) commitList.append(makeElement("li", "", "Unknown"));
  sourceItem.append(commitList);
  elements.metadata.append(sourceItem);
}

function renderHeading() {
  elements.runHeading.replaceChildren();
  const title = makeElement("h2", "", state.manifest ? `Run · ${state.manifest.date}` : "Local result files");
  const commit = state.manifest?.hol_light_commit || state.reports.find((r) => r.data.hol_light_commit)?.data.hol_light_commit;
  const subtitle = makeElement("p", "", commit ? `HOL Light ${commit}` : "Ad hoc report set");
  elements.runHeading.append(title, subtitle);
}

function renderSummary() {
  elements.summaryCards.replaceChildren();
  const totals = { pass: 0, fail: 0, skip: 0, missing: 0, tests: 0 };
  for (const report of state.reports) {
    const data = report.data;
    const card = makeElement("article", "summary-card");
    const top = makeElement("div", "card-top");
    const heading = makeElement("div");
    heading.append(makeElement("h3", "", report.label));
    const variant = data.arch ? `${data.arch.toUpperCase()} proofs` : report.fileName;
    heading.append(makeElement("div", "card-total", variant));
    top.append(heading, makeElement("div", "card-total", `${data.total ?? data.tests.length} tests`));
    card.append(top);

    const counts = makeElement("div", "card-counts");
    for (const status of ["pass", "fail", "skip", "missing"]) {
      const count = Number(data.counts?.[status] || 0);
      totals[status] += count;
      if (count) counts.append(statusPill(status, count));
    }
    totals.tests += Number(data.total ?? data.tests.length);
    card.append(counts, makeElement("p", "card-time", `Σ test time ${formatDuration(data.total_elapsed_seconds)}`));
    elements.summaryCards.append(card);
  }

  const bad = totals.fail + totals.missing;
  elements.overall.replaceChildren();
  const strong = makeElement("strong", "", bad ? `${bad} require attention` : "No failures or missing tests");
  elements.overall.append(strong, document.createTextNode(` · ${totals.pass}/${totals.tests} passed`));
}

function allTests() {
  return state.reports.flatMap((report) => (report.data.tests || []).map((test) => ({
    ...test,
    suite: report.label,
  })));
}

function makeTestRow(test) {
  const row = document.createElement("tr");
  row.className = "test-row";
  row.append(makeElement("td", "suite-name", ""));
  row.append(makeElement("td", "test-name", test.name));
  const statusCell = document.createElement("td");
  statusCell.append(statusPill(test.status));
  row.append(statusCell);
  row.append(makeElement("td", "numeric", formatDuration(test.elapsed_seconds)));

  const proofCell = document.createElement("td");
  const outputs = test.specs || test.theorems || [];
  if (outputs.length) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = `${outputs.length} theorem${outputs.length === 1 ? "" : "s"}`;
    const list = makeElement("ul", "proof-list");
    for (const output of outputs) list.append(makeElement("li", "", output));
    details.append(summary, list);
    proofCell.append(details);
  } else {
    proofCell.textContent = "—";
  }
  row.append(proofCell);
  return row;
}

function renderResults() {
  const query = elements.search.value.trim().toLowerCase();
  const wantedStatus = elements.statusFilter.value;
  const filtering = Boolean(query) || wantedStatus !== "all";
  const tests = allTests();
  const filtered = tests.filter((test) => {
    const matchesStatus = wantedStatus === "all" || test.status === wantedStatus;
    const haystack = `${test.suite} ${test.name} ${(test.specs || []).join(" ")} ${(test.theorems || []).join(" ")}`.toLowerCase();
    return matchesStatus && (!query || haystack.includes(query));
  });
  const rank = { fail: 0, missing: 1, skip: 2, pass: 3 };

  elements.expandAll.disabled = filtering;
  elements.collapseAll.disabled = filtering;

  const fragment = document.createDocumentFragment();
  let displayedSuites = 0;
  let expandedSuites = 0;

  for (const report of state.reports) {
    const suiteTests = filtered
      .filter((test) => test.suite === report.label)
      .sort((a, b) =>
        (rank[a.status] ?? 9) - (rank[b.status] ?? 9)
        || String(a.name).localeCompare(String(b.name))
      );
    if (!suiteTests.length) continue;
    displayedSuites += 1;

    const collapsed = !filtering && state.collapsedSuites.has(report.label);
    if (!collapsed) expandedSuites += 1;

    const groupRow = document.createElement("tr");
    groupRow.className = "suite-group-row";
    const groupCell = document.createElement("td");
    groupCell.colSpan = 5;
    const toggle = makeElement("button", "suite-toggle");
    toggle.type = "button";
    toggle.disabled = filtering;
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.append(
      makeElement("span", "suite-arrow", collapsed ? "▶" : "▼"),
      makeElement("span", "suite-title", report.label),
      makeElement(
        "span",
        "suite-count",
        filtering
          ? `${suiteTests.length} matching of ${report.data.tests.length}`
          : `${suiteTests.length} tests`,
      ),
    );
    const groupStatuses = makeElement("span", "suite-statuses");
    for (const status of ["pass", "fail", "skip", "missing"]) {
      const count = suiteTests.filter((test) => test.status === status).length;
      if (count) groupStatuses.append(statusPill(status, count));
    }
    toggle.append(groupStatuses);
    toggle.addEventListener("click", () => {
      if (state.collapsedSuites.has(report.label)) {
        state.collapsedSuites.delete(report.label);
      } else {
        state.collapsedSuites.add(report.label);
      }
      renderResults();
    });
    groupCell.append(toggle);
    groupRow.append(groupCell);
    fragment.append(groupRow);

    if (!collapsed) {
      for (const test of suiteTests) fragment.append(makeTestRow(test));
    }
  }

  elements.resultsBody.replaceChildren(fragment);
  elements.emptyResults.hidden = filtered.length !== 0;
  elements.resultCount.textContent = filtering
    ? `Showing ${filtered.length.toLocaleString()} matching tests in ${displayedSuites} suites`
    : `${tests.length.toLocaleString()} tests in ${displayedSuites} suites · ${expandedSuites} expanded`;
}

function render() {
  if (!state.reports.length) return;
  elements.emptyState.hidden = true;
  elements.dashboard.hidden = false;
  renderHeading();
  renderMetadata();
  renderSummary();
  renderResults();
}

async function initializePublishedRuns() {
  if (window.location.protocol === "file:" && embeddedRuns.length) {
    const runs = embeddedRuns.map((entry) => entry.index);
    populateRunSelect(runs, (run) => `embedded:${run.id}`);
    elements.runSelect.value = `embedded:${runs[0].id}`;
    loadEmbeddedRun(runs[0].id);
    return;
  }

  try {
    const index = await fetchJson("runs.json");
    populateRunSelect(index.runs || [], (run) => run.manifest);
    if (index.runs?.length) {
      elements.runSelect.value = index.runs[0].manifest;
      await loadPublishedRun(index.runs[0].manifest);
    }
  } catch (error) {
    if (embeddedRuns.length) {
      const runs = embeddedRuns.map((entry) => entry.index);
      populateRunSelect(runs, (run) => `embedded:${run.id}`);
      elements.runSelect.value = `embedded:${runs[0].id}`;
      loadEmbeddedRun(runs[0].id);
      showNotice("The JSON index could not be fetched, so bundled results are shown instead.");
    } else {
      elements.runSelect.replaceChildren(new Option("Published runs unavailable", ""));
      showNotice(`Could not load runs.json: ${error.message}`, true);
    }
  }
}

elements.runSelect.addEventListener("change", () => {
  const value = elements.runSelect.value;
  if (!value) return;
  if (value.startsWith("embedded:")) {
    loadEmbeddedRun(value.slice("embedded:".length));
  } else {
    loadPublishedRun(value);
  }
});
elements.search.addEventListener("input", renderResults);
elements.statusFilter.addEventListener("change", renderResults);
elements.expandAll.addEventListener("click", () => {
  state.collapsedSuites.clear();
  renderResults();
});
elements.collapseAll.addEventListener("click", () => {
  state.collapsedSuites = new Set(state.reports.map(({ label }) => label));
  renderResults();
});

initializePublishedRuns();
