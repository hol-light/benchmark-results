"use strict";

// Renders one section per benchmark in benchmarks-registry.js.
function renderBenchmarkSections() {
  const container = document.querySelector("#benchmark-sections");
  const fragment = document.createDocumentFragment();
  for (const benchmark of BENCHMARK_REGISTRY.benchmarks) {
    const section = document.createElement("section");
    section.id = benchmark.id;
    const heading = document.createElement("h2");
    heading.textContent = benchmark.title;
    section.append(heading);
    for (const html of benchmark.description) {
      const paragraph = document.createElement("p");
      paragraph.innerHTML = html;
      section.append(paragraph);
    }
    if (benchmark.passCriteria) {
      const paragraph = document.createElement("p");
      paragraph.innerHTML = `<strong>Pass requires:</strong> no failure marker in the log. ${benchmark.passCriteria}`;
      section.append(paragraph);
    }
    fragment.append(section);
  }
  container.replaceChildren(fragment);

  // The sections did not exist when the browser first looked for the anchor.
  if (window.location.hash) {
    document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView();
  }
}

renderBenchmarkSections();
