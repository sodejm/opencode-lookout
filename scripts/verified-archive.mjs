/** Extract only an exact, reviewed archive; never persist the downloaded archive. */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

/**
 * Validate before invoking tar, passing the same verified bytes through stdin.
 * The digest is a repository-owned pin, never downloaded metadata. The caller
 * supplies a fresh private directory so stale rules cannot enter the scan.
 * @param {Buffer} archive Downloaded bytes.
 * @param {string} expected Reviewed SHA-256 digest.
 * @param {string} directory Fresh extraction directory.
 */
export function extractVerifiedArchive(archive, expected, directory) {
  if (
    !/^[a-f0-9]{64}$/.test(expected) ||
    createHash("sha256").update(archive).digest("hex") !== expected
  )
    throw new Error("Semgrep rules checksum mismatch");
  const result = spawnSync(
    "tar",
    ["-xzf", "-", "-C", directory, "--strip-components=1"],
    {
      input: archive,
      encoding: "utf8",
      timeout: 120000,
      maxBuffer: 1024 * 1024,
    },
  );
  if (result.status !== 0 || result.error)
    throw new Error(
      `Rules extraction failed: ${result.error?.message ?? result.stderr}`,
    );
}
