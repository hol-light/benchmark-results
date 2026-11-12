"use strict";

// Everything the dashboard knows about individual benchmarks lives here.
// To add a benchmark, add its source repository to `sources` (if it has one)
// and an entry to `benchmarks`. The run itself (manifest.json and report
// files) needs no registration: pages list whatever reports a manifest names.
//
// sources: provenance shown as "Source commits" on the results page.
//   name         display name; also the key into manifest.repositories,
//                which overrides `repository` (for example, for forks).
//   commitField  report JSON field holding the source's commit hash.
//   repository   default repository URL for commit links.
//
// benchmarks: sections of benchmarks.html, in display order.
//   id           anchor on benchmarks.html (benchmarks.html#<id>).
//   title        section heading.
//   reports      manifest report labels that belong to this benchmark; their
//                summary cards on the results page link to the section.
//   description  paragraphs (trusted HTML).
//   passCriteria what a passing result requires beyond the shared failure
//                markers (trusted HTML).
const BENCHMARK_REGISTRY = {
  sources: [
    {
      name: "HOL Light",
      commitField: "hol_light_commit",
      repository: "https://github.com/jrh13/hol-light",
    },
    {
      name: "s2n-bignum",
      commitField: "s2n_bignum_commit",
      repository: "https://github.com/awslabs/s2n-bignum",
    },
    {
      name: "Flyspeck",
      commitField: "flyspeck_commit",
      repository: "https://github.com/hol-light-family/Flyspeck",
    },
    {
      name: "Navier-Stokes",
      commitField: "navier_stokes_commit",
      repository: "https://github.com/hol-light-family/Navier_Stokes",
    },
    {
      name: "catalan-is-irrational",
      commitField: "catalan_is_irrational_commit",
      repository: "https://github.com/hol-light-family/catalan-is-irrational",
    },
    {
      name: "Poincare",
      commitField: "poincare_commit",
      repository: "https://github.com/hol-light-family/Poincare",
    },
  ],

  // The scripts that produced a run; its commit comes from the manifest.
  scripts: {
    name: "benchmark-scripts",
    repository: "https://github.com/hol-light-family/benchmark-scripts",
  },

  benchmarks: [
    {
      id: "holtest",
      title: "HOL Light regression suite",
      reports: ["HOL Light"],
      description: [
        '<a href="https://github.com/jrh13/hol-light">HOL Light</a> includes <code>holtest.mk</code>, a broad regression suite covering its libraries, examples, decision procedures, formalized mathematics, and supported external tools.',
        "The runner executes independent test targets concurrently. Each test has its own log and timing. A test may be skipped when an optional external program is unavailable; the archived runs normally skip the legacy zChaff/MiniSat-p test.",
      ],
      passCriteria: "Each test must also produce its <code>.ready</code> file.",
    },
    {
      id: "s2n-bignum",
      title: "s2n-bignum: ARM and x86",
      reports: ["s2n-bignum ARM", "s2n-bignum x86"],
      description: [
        '<a href="https://github.com/awslabs/s2n-bignum">s2n-bignum</a> contains optimized assembly routines for cryptographic big-integer arithmetic, together with HOL Light proofs of functional correctness and related safety properties.',
        "ARM and x86 are separate reports. The runner assembles each architecture's source and checks the proof against the resulting object code. Foreign machine code is not executed, so the non-native architecture only needs a cross-assembler rather than an emulator. Proof binaries are built and checked concurrently with a memory-based job limit.",
      ],
      passCriteria: "Each proof log must also end with its <code>Running time</code> line. A proof that fails to build is reported as failed; the run keeps going past it.",
    },
    {
      id: "flyspeck",
      title: "Flyspeck",
      reports: ["Flyspeck"],
      description: [
        '<a href="https://github.com/hol-light-family/Flyspeck">Flyspeck</a> is the formal proof of the Kepler conjecture. The benchmark loads <code>load_flyspeck.ml</code> and evaluates the complete <code>Build.build_sequence_full</code>.',
        "The run verifies the archived linear-program certificates and loads the text formalization. The nonlinear inequalities are imported against recorded digests rather than recomputed; their original recomputation required a large external Azure workload. The tame-hypermap classification is verified separately in Isabelle, as documented by Flyspeck.",
      ],
      passCriteria: "The session must reach its completion marker.",
    },
    {
      id: "four-colour",
      title: "Four Colour Theorem",
      reports: ["Four Colour Theorem"],
      description: [
        'HOL Light\'s <a href="https://github.com/jrh13/hol-light/tree/master/4CT"><code>4CT/</code> development</a> proves the Four Colour Theorem for hypermaps, planar graphs, and plane maps.',
        "The benchmark uses the OCaml 5 parallel bytecode route. Its proof-producing computations distribute the presentation checks and 633 reducibility checks over as many as 128 OCaml domains.",
      ],
      passCriteria: "The session must reach its completion marker and bind <code>FOUR_COLOR</code>, <code>FOUR_COLOR_PLANAR_GRAPH</code>, and <code>FOUR_COLOR_MAP</code>.",
    },
    {
      id: "navier-stokes",
      title: "Navier-Stokes",
      reports: ["Navier-Stokes"],
      description: [
        '<a href="https://github.com/hol-light-family/Navier_Stokes">Navier_Stokes</a> formalizes finite-time blowup for the incompressible Navier-Stokes equations and derives the breakdown alternatives (C) and (D) from the Clay Millennium Prize problem statement.',
        "The first stage loads <code>check.ml</code>, which checks the complete development and its headline theorems. The second loads <code>audit/check.ml</code>, which checks an independent formalization of the Clay statements, equivalence theorems, and 24 statement sanity theorems.",
      ],
      passCriteria: "Each stage must reach its completion marker, each reported theorem must have no hypotheses and the expected conclusion, and the session must use only HOL Light's three standard axioms.",
    },
    {
      id: "catalan-is-irrational",
      title: "Catalan's constant is irrational",
      reports: ["Catalan's constant irrational"],
      description: [
        '<a href="https://github.com/hol-light-family/catalan-is-irrational">catalan-is-irrational</a> proves that Catalan\'s constant G = 1 − 1/3² + 1/5² − 1/7² + ⋯ is irrational, following the paper <em>Catalan\'s constant is irrational</em> (OpenAI, 2026).',
        "The benchmark loads <code>make.ml</code>, which loads HOL Light's <code>100/pnt.ml</code> and <code>Library/ring_det.ml</code> and then the development. Most of the development's own time goes to the exact rational arithmetic of its real-place certificate.",
      ],
      passCriteria: "The session must reach its completion marker; <code>CATALAN_CONSTANT_IRRATIONAL_HEADLINE</code>, <code>CATALAN_CONSTANT_IRRATIONAL</code>, and <code>CATALAN_IRRATIONAL</code> must have no hypotheses and exactly the expected conclusions; and the session must use only HOL Light's three standard axioms. The headline statement is written in the benchmark script using only HOL Light's own notions, so it is checked without trusting the development's definitions.",
    },
    {
      id: "poincare",
      title: "Poincare conjecture",
      reports: ["Poincare conjecture"],
      description: [
        '<a href="https://github.com/hol-light-family/Poincare">Poincare</a> proves the Poincare conjecture: every closed, simply connected 3-manifold is homeomorphic to the 3-sphere, and in the smooth form diffeomorphic to it. It follows Perelman\'s proof as presented in Morgan and Tian, <em>Ricci Flow and the Poincare Conjecture</em> (2007), with Moise\'s theorem that every topological 3-manifold has a smooth structure.',
        "The first stage loads <code>check.ml</code>, which loads HOL Light's <code>Multivariate/cauchy.ml</code>, <code>Multivariate/lpspaces.ml</code>, and <code>100/green.ml</code>, then the development's 1,090 files, and prints the headline theorems and the axioms. The second loads <code>audit/check.ml</code>, which checks an independent formalization of both forms of the conjecture, its equivalence with the development's statements, and 30 statement sanity theorems. It is the longest single-core benchmark: upstream reports about 7 hours of CPU time and a peak of about 17.5 GiB of memory.",
      ],
      passCriteria: "Each stage must reach its completion marker. For <code>check.ml</code>, <code>POINCARE_TOP</code>, <code>POINCARE_SMOOTH</code>, and <code>POINCARE_EMBEDDED</code> must have no hypotheses and conclude exactly their statement constant applied to <code>(:A)</code> for a type variable <code>A</code>; <code>MOI_SST_HEADLINE</code> must have no hypotheses and conclude <code>!u:A-&gt;bool. MOISE_SMOOTHING_STATEMENT u</code>. For <code>audit/check.ml</code>, the two equivalence theorems and the two proved independent statements must have no hypotheses and the expected conclusions, and every sanity theorem no hypotheses. The session must use only HOL Light's three standard axioms.",
    },
  ],
};

// The benchmark whose `reports` include a manifest report label, if any.
function benchmarkForReport(label) {
  return BENCHMARK_REGISTRY.benchmarks.find((benchmark) => benchmark.reports.includes(label)) || null;
}
