/** Pure fail-closed release policy. No network, process execution, or severity waivers. */

/** @param {unknown} value Candidate record. @returns {Record<string, unknown>} Valid object. */
function record(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected report object");
  return /** @type {Record<string, unknown>} */ (value);
}
/** @param {unknown} value Required empty findings/errors array. */
function empty(value) {
  if (!Array.isArray(value) || value.length)
    throw new Error("Missing array or reported findings/errors");
}
/**
 * Reject every finding (including unknown severity), malformed report, or scanner failure.
 * The caller must capture the process status itself; JSON alone cannot prove execution.
 * @param {string} kind Scanner name.
 * @param {unknown} report Parsed scanner JSON.
 * @param {number | null | undefined} exit Actual process exit status.
 */
export function scanClean(kind, report, exit) {
  if (exit !== 0) throw new Error(`${kind}: scanner failed (${exit})`);
  if (kind === "gitleaks") return empty(report);
  const r = record(report);
  if (Object.hasOwn(r, "error")) throw new Error(`${kind}: reported error`);
  if (Object.hasOwn(r, "errors")) empty(r.errors);
  if (kind === "audit") {
    if (
      r.auditReportVersion !== 2 ||
      Object.keys(record(r.vulnerabilities)).length
    )
      throw new Error("Audit findings or unsupported schema");
    const metadata = record(r.metadata),
      counts = record(metadata.vulnerabilities);
    for (const key of ["info", "low", "moderate", "high", "critical", "total"])
      if (counts[key] !== 0)
        throw new Error("Audit findings or missing counts");
    if (!(Number(record(metadata.dependencies).total) > 0))
      throw new Error("No dependencies audited");
  } else if (kind === "signatures") {
    empty(r.invalid);
    empty(r.missing);
  } else if (kind === "semgrep") {
    empty(r.results);
    empty(r.errors);
    const scanned = record(r.paths).scanned;
    if (
      typeof r.version !== "string" ||
      !Array.isArray(scanned) ||
      !scanned.length
    )
      throw new Error("No Semgrep coverage");
    for (const path of [
      "src/server.ts",
      "src/tui.tsx",
      "src/config.mjs",
      "src/controller.mjs",
      "bin/lookout.mjs",
      "scripts/security.mjs",
      "test/integration.mjs",
      ".github/workflows/ci.yml",
    ])
      if (!scanned.includes(path))
        throw new Error(`Missing Semgrep coverage: ${path}`);
  } else if (kind === "codeql") {
    if (r.version !== "2.1.0" || !Array.isArray(r.runs) || !r.runs.length)
      throw new Error("Missing CodeQL runs");
    for (const run of r.runs) {
      const entry = record(run);
      if (record(record(entry.tool).driver).name !== "CodeQL")
        throw new Error("Unexpected SARIF tool");
      empty(entry.results);
      // SARIF invocations are optional. The workflow requires a successful analyze
      // step before this validator; recorded diagnostics must not indicate failure.
      if (entry.invocations !== undefined && !Array.isArray(entry.invocations))
        throw new Error("Malformed CodeQL execution evidence");
      for (const invocation of entry.invocations ?? []) {
        const execution = record(invocation);
        if (
          execution.executionSuccessful !== undefined &&
          execution.executionSuccessful !== true
        )
          throw new Error("CodeQL execution failed");
        for (const key of [
          "toolExecutionNotifications",
          "toolConfigurationNotifications",
        ]) {
          if (execution[key] === undefined) continue;
          if (!Array.isArray(execution[key]))
            throw new Error("Malformed CodeQL notifications");
          for (const notification of execution[key])
            if (record(notification).level !== "note")
              throw new Error(
                `CodeQL warning/error: ${JSON.stringify(notification)}`,
              );
        }
      }
    }
  } else if (kind === "trivy") {
    if (
      r.SchemaVersion !== 2 ||
      !Array.isArray(r.Results) ||
      !r.Results.some((v) => record(v).Target === "package-lock.json")
    )
      throw new Error("No lockfile scan");
    for (const result of r.Results) {
      const entry = record(result);
      for (const key of [
        "Vulnerabilities",
        "Misconfigurations",
        "Secrets",
        "Licenses",
      ])
        if (entry[key] !== undefined) empty(entry[key]);
    }
  } else throw new Error(`Unknown scanner: ${kind}`);
}

/** @param {string} value Strict stable or rc.N version. */
function version(value) {
  const match =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-rc\.(0|[1-9]\d*))?$/.exec(
      value,
    );
  return match
    ? match
        .slice(1)
        .map((v, i) => (v === undefined && i === 3 ? Infinity : Number(v)))
    : null;
}
/** @param {string} a Version. @param {string} b Version. */
function compare(a, b) {
  const x = version(a),
    y = version(b);
  if (!x || !y) throw new Error("Invalid CLI version");
  for (let i = 0; i < 4; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}
/**
 * Select five newest stable V2+ releases and highest RC of the nearest future release.
 * Dev/beta tags and RCs for already stable versions are not release candidates.
 * @param {string[]} versions Registry version keys, not publication order.
 * @returns {string[]} Required test targets; throws if discovery is incomplete.
 */
export function discoverVersions(versions) {
  const valid = [...new Set(versions)].filter(
    (v) => (version(v)?.[0] ?? 0) >= 2,
  );
  const stable = valid
    .filter((v) => !v.includes("-"))
    .sort(compare)
    .slice(-5);
  if (stable.length !== 5)
    throw new Error("Five stable CLI versions are required");
  const rc = valid
    .filter(
      (v) => v.includes("-rc.") && compare(v.split("-")[0], stable[4]) > 0,
    )
    .sort(compare);
  const next = rc[0]?.split("-")[0];
  const candidate = rc.filter((v) => v.split("-")[0] === next).at(-1);
  return candidate ? [...stable, candidate] : stable;
}

/**
 * Validate a locally produced receipt against freshly discovered targets and source.
 * Receipts are evidence, not signatures or human approval. Freshness window: 24 hours.
 * @param {unknown} value Receipt from this repository's runner.
 * @param {{source:string, commit:string, targets:string[], now?:number}} expected Current release inputs.
 */
export function validateEvidence(
  value,
  { source, commit, targets, now = Date.now() },
) {
  const r = record(value);
  const age = now - Date.parse(String(r.created));
  if (
    r.schema !== 1 ||
    r.source !== source ||
    r.commit !== commit ||
    !Number.isFinite(age) ||
    age < -60000 ||
    age > 86400000
  )
    throw new Error("Stale or mismatched release evidence");
  if (JSON.stringify(r.targets) !== JSON.stringify(targets))
    throw new Error("Compatibility discovery changed");
  const checks = [
    "quality",
    "audit",
    "signatures",
    "semgrep",
    "gitleaks",
    "trivy",
  ];
  if (!Array.isArray(r.checks) || r.checks.length !== checks.length)
    throw new Error("Incomplete checks");
  for (const name of checks)
    if (
      r.checks.filter((c) => record(c).name === name && record(c).exit === 0)
        .length !== 1
    )
      throw new Error(`Failed/missing ${name}`);
  if (
    !Array.isArray(r.compatibility) ||
    r.compatibility.length !== targets.length * 2
  )
    throw new Error("Incomplete compatibility matrix");
  for (const target of targets)
    for (const mode of ["wide", "narrow"]) {
      const entries = r.compatibility.filter(
        (c) => record(c).version === target && record(c).mode === mode,
      );
      if (entries.length !== 1)
        throw new Error("Missing/duplicate compatibility result");
      const entry = record(entries[0]);
      const profile = ["2.2.1", "2.2.2"].includes(target)
        ? "read-only"
        : "controls";
      if (entry.profile !== profile)
        throw new Error("Wrong compatibility profile");
      if (
        entry.exit !== 0 ||
        !/^sha256:[a-f0-9]{64}$/.test(String(entry.image)) ||
        !/^sha512-[A-Za-z0-9+/]{86}==$/.test(String(entry.integrity))
      )
        throw new Error("Failed or unbound compatibility result");
    }
}
