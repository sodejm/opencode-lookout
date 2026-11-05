import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractVerifiedArchive } from "../scripts/verified-archive.mjs";

test("rule extraction rejects changed bytes before writing and recovers with the pinned archive", (t) => {
  const root = mkdtempSync(join(tmpdir(), "lookout-rules-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "source"));
  mkdirSync(join(root, "output"));
  writeFileSync(join(root, "source", "rule.yml"), "reviewed rule");
  const archive = execFileSync("tar", ["-czf", "-", "-C", root, "source"]);
  const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const hash = digest(archive);
  const changed = Buffer.from(archive);
  changed[0] ^= 1;
  for (const [bytes, pin] of [
    [changed, hash],
    [archive, ""],
    [archive, "f".repeat(64)],
  ]) {
    assert.throws(
      () => extractVerifiedArchive(bytes, pin, join(root, "output")),
      /checksum mismatch/,
    );
    assert.deepEqual(readdirSync(join(root, "output")), []);
  }
  const invalid = Buffer.from("not a tar archive");
  assert.throws(
    () =>
      extractVerifiedArchive(invalid, digest(invalid), join(root, "output")),
    /extraction failed/,
  );
  extractVerifiedArchive(archive, hash, join(root, "output"));
  assert.equal(
    readFileSync(join(root, "output", "rule.yml"), "utf8"),
    "reviewed rule",
  );
  assert.deepEqual(readdirSync(root).sort(), ["output", "source"]);
});
