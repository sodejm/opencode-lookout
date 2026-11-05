/** Pinned OSS scanners. Every finding, scanner error, or malformed report blocks. */
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { scanClean } from "./release-policy.mjs";
import { output, sourceDigest, sourceFiles } from "./release-io.mjs";

const directory = "release-evidence";
await mkdir(directory, { recursive: true });
await writeFile(`${directory}/security.json`, "");
const source = sourceDigest();
if (output("git", ["rev-parse", "--is-shallow-repository"]) !== "false")
  throw new Error("Full history is required for secret scanning");
for (const [
  tool,
  args,
  expected,
] of /** @type {Array<[string,string[],string]>} */ ([
  ["semgrep", ["--version"], "1.182.0"],
  ["trivy", ["--version"], "Version: 0.76.1"],
  ["gitleaks", ["version"], "8.30.1"],
]))
  if (output(tool, args).split("\n")[0] !== expected)
    throw new Error(`Install reviewed ${tool} ${expected}`);

// Security-only language and Actions rules: not React i18n/style packs or Pro rules.
// The upstream rule archive is used under the Semgrep Rules License, not relicensed.
const rulesCommit = "16b9e6d45f10649f6a531ec4838ed9924372c3bc";
const rulesHash =
  "70b4e0adca0515de0a07c15341ce50ed76221ab2f7bc59baca25caebaa5664f6";
await mkdir(".build/semgrep-rules", { recursive: true });
const response = await fetch(
  `https://api.github.com/repos/semgrep/semgrep-rules/tarball/${rulesCommit}`,
  { signal: AbortSignal.timeout(60000) },
);
if (!response.ok) throw new Error(`Rules download HTTP ${response.status}`);
const archive = Buffer.from(await response.arrayBuffer());
if (createHash("sha256").update(archive).digest("hex") !== rulesHash)
  throw new Error("Semgrep rules checksum mismatch");
await writeFile(".build/rules.tgz", archive);
output("tar", [
  "-xzf",
  ".build/rules.tgz",
  "-C",
  ".build/semgrep-rules",
  "--strip-components=1",
]);

/** @type {Array<{name:string, exit:number}>} */
const checks = [];
/** @param {string} name Policy name. @param {string} command Executable. @param {string[]} args Arguments. @param {boolean} fileOutput Scanner writes JSON itself. */
async function scan(name, command, args, fileOutput = false) {
  const path = `${directory}/${name}.json`;
  // Clear stale success before starting; a crashing scanner cannot reuse prior output.
  await writeFile(path, "");
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 600000,
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      SEMGREP_SEND_METRICS: "off",
      SEMGREP_ENABLE_VERSION_CHECK: "0",
    },
  });
  await writeFile(`${directory}/${name}.log`, result.stderr ?? "");
  if (!fileOutput) await writeFile(path, result.stdout ?? "");
  const report = JSON.parse(await readFile(path, "utf8"));
  scanClean(name, report, result.status);
  checks.push({ name, exit: 0 });
  console.log(`PASS ${name}: no configured findings or errors`);
}
await scan("audit", "npm", [
  "audit",
  "--json",
  "--include=dev",
  "--include=optional",
  "--include=peer",
]);
await scan("signatures", "npm", ["audit", "signatures", "--json"]);
await scan("semgrep", "semgrep", [
  "scan",
  ...[
    "javascript/lang/security",
    "typescript/lang/security",
    "yaml/github-actions/security",
  ].flatMap((path) => ["--config", `.build/semgrep-rules/${path}`]),
  "--metrics",
  "off",
  "--disable-version-check",
  "--disable-nosem",
  "--strict",
  "--error",
  "--json",
  // Keep downloaded rule test fixtures out even when Git metadata is unavailable
  // inside a read-only container mount. Dependency code is audited separately.
  ...[
    "node_modules",
    ".build",
    "release-evidence",
    "test-artifacts",
    ".git",
  ].flatMap((path) => ["--exclude", path]),
  ".",
]);
await scan(
  "gitleaks",
  "gitleaks",
  [
    "git",
    "--redact",
    "--log-opts=--all",
    "--report-format",
    "json",
    "--report-path",
    `${directory}/gitleaks.json`,
    ".",
  ],
  true,
);
// Scan the working tree too: git history does not contain uncommitted release code.
await writeFile(`${directory}/gitleaks-working.json`, "");
const working = spawnSync(
  "gitleaks",
  [
    "stdin",
    "--redact",
    "--report-format",
    "json",
    "--report-path",
    `${directory}/gitleaks-working.json`,
  ],
  {
    input: sourceFiles()
      .filter(existsSync)
      .map((path) => `${path}\n${readFileSync(path, "utf8")}`)
      .join("\n"),
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 32 * 1024 * 1024,
  },
);
if (working.status !== 0) throw new Error("Working-tree secret scan failed");
scanClean(
  "gitleaks",
  JSON.parse(await readFile(`${directory}/gitleaks-working.json`, "utf8")),
  working.status,
);
await scan("trivy", "trivy", [
  "fs",
  "--scanners",
  "vuln,misconfig",
  "--exit-code",
  "1",
  "--format",
  "json",
  "--skip-dirs",
  "node_modules",
  "--skip-dirs",
  ".git",
  "--skip-dirs",
  ".build",
  "--skip-dirs",
  directory,
  ".",
]);
if (sourceDigest() !== source)
  throw new Error("Source changed during security run");
await writeFile(
  `${directory}/security.json`,
  JSON.stringify(
    {
      source,
      created: new Date().toISOString(),
      rulesCommit,
      rulesHash,
      checks,
    },
    null,
    2,
  ),
);
