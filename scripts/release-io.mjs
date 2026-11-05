/** Release runner I/O. Child commands never use shell interpolation. */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { discoverVersions } from "./release-policy.mjs";

/** @param {string} command Executable. @param {string[]} args Argument vector. @returns {string} stdout, or throw. */
export function output(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0 || result.error)
    throw new Error(
      `${command} failed: ${result.error?.message ?? result.stderr}`,
    );
  return result.stdout.trim();
}
/** Return every tracked and nonignored new filename, including deleted tracked files. */
export function sourceFiles() {
  const paths = output("git", [
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
  ])
    .split("\0")
    .filter(Boolean);
  return [...new Set(paths)].sort();
}
/** Hash existing tracked and nonignored source bytes; staging/committing cannot change the digest. */
export function sourceDigest() {
  const hash = createHash("sha256");
  for (const path of sourceFiles()) {
    if (!existsSync(path)) continue;
    hash.update(path).update("\0");
    hash.update(readFileSync(path)).update("\0");
  }
  return hash.digest("hex");
}
/** Discover targets from the public npm registry; network errors block, never reuse a fallback list. */
export async function discover() {
  const response = await fetch("https://registry.npmjs.org/@opencode%2fcli", {
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`CLI discovery HTTP ${response.status}`);
  const data = await response.json();
  if (!data.versions || typeof data.versions !== "object")
    throw new Error("Invalid CLI registry metadata");
  return discoverVersions(Object.keys(data.versions));
}
