/** Match the actual tarball to fresh source-bound Docker and release receipts. */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { packageArtifact } from "./package-artifact.mjs";
import { output, sourceDigest } from "./release-io.mjs";

const artifact = packageArtifact();
const bytes = await readFile(process.argv[2]);
if (
  "sha512-" + createHash("sha512").update(bytes).digest("base64") !==
  artifact.integrity
)
  throw new Error("Tarball differs from current source");
const source = sourceDigest();
const commit = output("git", ["rev-parse", "HEAD"]);
if (output("git", ["status", "--porcelain"]))
  throw new Error("Dirty publication source");
for (const name of ["compatibility", "release"]) {
  const receipt = JSON.parse(
    await readFile(`release-evidence/${name}.json`, "utf8"),
  );
  const age = Date.now() - Date.parse(receipt.created);
  if (
    receipt.source !== source ||
    (name === "release" && receipt.commit !== commit) ||
    receipt.artifact?.integrity !== artifact.integrity ||
    !Number.isFinite(age) ||
    age < 0 ||
    age > 86400000
  )
    throw new Error("Missing, stale or mismatched package evidence");
}
console.log(`PASS exact tested tarball: ${artifact.integrity}`);
