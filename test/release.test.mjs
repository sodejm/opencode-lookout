import test from "node:test";
import assert from "node:assert/strict";
import {
  scanClean,
  discoverVersions,
  validateEvidence,
} from "../scripts/release-policy.mjs";

const reports = {
  audit: {
    auditReportVersion: 2,
    vulnerabilities: {},
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 0,
        high: 0,
        critical: 0,
        total: 0,
      },
      dependencies: { total: 10 },
    },
  },
  signatures: { invalid: [], missing: [] },
  semgrep: {
    version: "1.182.0",
    results: [],
    errors: [],
    paths: {
      scanned: [
        "src/server.ts",
        "src/tui.tsx",
        "src/config.mjs",
        "src/controller.mjs",
        "bin/lookout.mjs",
        "scripts/security.mjs",
        "test/integration.mjs",
        ".github/workflows/ci.yml",
      ],
    },
  },
  gitleaks: [],
  trivy: {
    SchemaVersion: 2,
    Results: [{ Target: "package-lock.json", Class: "lang-pkgs", Type: "npm" }],
  },
};
test("CodeQL rejects findings of every level, failed analysis, and malformed evidence", () => {
  const run = {
    tool: { driver: { name: "CodeQL" } },
    results: [],
    invocations: [{ executionSuccessful: true }],
  };
  const report = { version: "2.1.0", runs: [run] };
  assert.doesNotThrow(() => scanClean("codeql", report, 0));
  assert.doesNotThrow(() =>
    scanClean(
      "codeql",
      { ...report, runs: [{ ...run, invocations: undefined }] },
      0,
    ),
  );
  assert.throws(() => scanClean("codeql", report, 1));
  for (const level of ["note", "warning", "error", undefined])
    assert.throws(() =>
      scanClean(
        "codeql",
        { ...report, runs: [{ ...run, results: [{ level }] }] },
        0,
      ),
    );
  for (const invocations of [
    {},
    [{ executionSuccessful: false }],
    [
      {
        executionSuccessful: true,
        toolExecutionNotifications: [{ level: "warning" }],
      },
    ],
  ])
    assert.throws(() =>
      scanClean("codeql", { ...report, runs: [{ ...run, invocations }] }, 0),
    );
  assert.throws(() => scanClean("codeql", { version: "2.1.0", runs: [] }, 0));
});
test("all scanners fail closed on errors, missing output, and any finding", () => {
  for (const [kind, report] of Object.entries(reports)) {
    assert.doesNotThrow(() => scanClean(kind, report, 0));
    for (const status of [1, 2, null, undefined])
      assert.throws(() => scanClean(kind, report, status));
    for (const invalid of [null, {}, "", []]) {
      if (kind === "gitleaks" && Array.isArray(invalid)) continue;
      assert.throws(() => scanClean(kind, invalid, 0));
    }
  }
  assert.throws(() => scanClean("unrecognized", {}, 0));
  assert.throws(() =>
    scanClean("audit", { ...reports.audit, error: { code: "NETWORK" } }, 0),
  );
  assert.throws(() =>
    scanClean("signatures", { ...reports.signatures, errors: [{}] }, 0),
  );
  assert.throws(() =>
    scanClean(
      "audit",
      {
        ...reports.audit,
        vulnerabilities: { dependency: { severity: "low" } },
      },
      0,
    ),
  );
  assert.throws(() =>
    scanClean(
      "audit",
      {
        ...reports.audit,
        metadata: {
          ...reports.audit.metadata,
          vulnerabilities: {
            ...reports.audit.metadata.vulnerabilities,
            total: 1,
          },
        },
      },
      0,
    ),
  );
  assert.throws(() =>
    scanClean("signatures", { invalid: [], missing: [{}] }, 0),
  );
  assert.throws(() => scanClean("gitleaks", [{ RuleID: "test" }], 0));
  assert.throws(() =>
    scanClean(
      "semgrep",
      { ...reports.semgrep, paths: { scanned: ["README.md"] } },
      0,
    ),
  );
  assert.throws(() =>
    scanClean(
      "semgrep",
      { ...reports.semgrep, errors: [{ level: "warn" }] },
      0,
    ),
  );
  assert.throws(() =>
    scanClean("semgrep", { ...reports.semgrep, paths: { scanned: [] } }, 0),
  );
  assert.throws(() =>
    scanClean(
      "semgrep",
      { ...reports.semgrep, results: [{ extra: { severity: "INFO" } }] },
      0,
    ),
  );
  for (const severity of ["LOW", "UNKNOWN", undefined])
    assert.throws(() =>
      scanClean(
        "trivy",
        {
          SchemaVersion: 2,
          Results: [
            {
              Target: "package-lock.json",
              Vulnerabilities: [{ Severity: severity }],
            },
          ],
        },
        0,
      ),
    );
  assert.throws(() =>
    scanClean(
      "trivy",
      {
        SchemaVersion: 2,
        Results: [
          {
            Target: "package-lock.json",
            Misconfigurations: [{ Status: "FAIL" }],
          },
        ],
      },
      0,
    ),
  );
});

test("discovery sorts semver, requires five stable releases, and includes the next RC", () => {
  const versions = [
    "2.2.1",
    "2.2.2",
    "2.2.3",
    "2.2.4",
    "2.2.5",
    "2.1.9",
    "2.2.6-rc.2",
    "2.2.6-rc.10",
    "2.3.0-rc.1",
    "2.2.5-rc.1",
    "0.0.0-dev-1",
  ];
  assert.deepEqual(discoverVersions(versions), [
    "2.2.1",
    "2.2.2",
    "2.2.3",
    "2.2.4",
    "2.2.5",
    "2.2.6-rc.10",
  ]);
  assert.deepEqual(
    discoverVersions(versions.slice(0, 5)),
    versions.slice(0, 5),
  );
  assert.throws(() => discoverVersions(versions.slice(0, 4)));
});

test("evidence rejects stale, future, mismatched, incomplete, and failed runs", () => {
  const now = Date.now();
  const targets = ["2.2.1", "2.2.2", "2.2.3", "2.2.4", "2.2.5"];
  const evidence = {
    schema: 1,
    source: "a".repeat(64),
    commit: "b".repeat(40),
    created: new Date(now).toISOString(),
    targets,
    checks: ["quality", ...Object.keys(reports)].map((name) => ({
      name,
      exit: 0,
    })),
    compatibility: targets.flatMap((version) =>
      ["wide", "narrow"].map((mode) => ({
        version,
        mode,
        profile: ["2.2.1", "2.2.2"].includes(version)
          ? "read-only"
          : "controls",
        exit: 0,
        image: "sha256:" + "c".repeat(64),
        integrity: "sha512-" + "d".repeat(86) + "==",
      })),
    ),
  };
  const verify = (data) =>
    validateEvidence(data, {
      source: evidence.source,
      commit: evidence.commit,
      targets,
      now,
    });
  assert.doesNotThrow(() => verify(evidence));
  for (const altered of [
    { source: "f".repeat(64) },
    { commit: "f".repeat(40) },
    { checks: [] },
    { created: new Date(now - 86400001).toISOString() },
    { created: new Date(now + 60001).toISOString() },
    { compatibility: evidence.compatibility.slice(1) },
    {
      compatibility: evidence.compatibility.map((result) => ({
        ...result,
        profile: "skipped",
      })),
    },
    { compatibility: [...evidence.compatibility, evidence.compatibility[0]] },
    { checks: evidence.checks.map((c) => ({ ...c, exit: 1 })) },
    { targets: targets.slice(1) },
  ])
    assert.throws(() => verify({ ...evidence, ...altered }));
});
