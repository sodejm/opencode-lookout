/** Assess a clean exact revision using fresh local security and Docker evidence; never publish. */
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { output, discover, sourceDigest } from "./release-io.mjs";
import { validateEvidence } from "./release-policy.mjs";

await writeFile("release-evidence/release.json", "");

if (output("git", ["status", "--porcelain"]))
  throw new Error("Commit the reviewed candidate before release assessment");
const source = sourceDigest();
const commit = output("git", ["rev-parse", "HEAD"]);
const targets = await discover();
const security = JSON.parse(
  await readFile("release-evidence/security.json", "utf8"),
);
const compatibility = JSON.parse(
  await readFile("release-evidence/compatibility.json", "utf8"),
);
for (const receipt of [security, compatibility]) {
  const age = Date.now() - Date.parse(receipt.created);
  if (
    receipt.source !== source ||
    !Number.isFinite(age) ||
    age < 0 ||
    age > 86400000
  )
    throw new Error(
      "Run fresh security and compatibility checks on this source",
    );
}
if (JSON.stringify(compatibility.targets) !== JSON.stringify(targets))
  throw new Error("CLI versions changed; rerun compatibility");
const quality = spawnSync("make", ["check"], {
  stdio: "inherit",
  timeout: 300000,
});
const evidence = {
  schema: 1,
  source,
  commit,
  created: new Date().toISOString(),
  targets,
  checks: [{ name: "quality", exit: quality.status }, ...security.checks],
  compatibility: compatibility.results,
};
validateEvidence(evidence, { source, commit, targets });
if (sourceDigest() !== source || output("git", ["status", "--porcelain"]))
  throw new Error("Source changed during assessment");
await writeFile(
  "release-evidence/release.json",
  JSON.stringify(evidence, null, 2),
);
console.log(
  `Local gates pass for ${commit}. Hosted checks and exact-revision maintainer approval are still required. Nothing published.`,
);
