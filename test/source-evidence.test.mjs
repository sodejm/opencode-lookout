import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

test("source evidence detects edits, additions and deletions, but not staging or ignored reports", (t) => {
  const root = mkdtempSync(join(tmpdir(), "lookout-source-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = { PATH: process.env.PATH, HOME: root, GIT_CONFIG_NOSYSTEM: "1" };
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
  git("init");
  writeFileSync(join(root, ".gitignore"), "receipt.json\n");
  writeFileSync(join(root, "source.txt"), "original");
  const moduleURL = new URL("../scripts/release-io.mjs", import.meta.url).href;
  const digest = () =>
    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import {sourceDigest} from ${JSON.stringify(moduleURL)}; console.log(sourceDigest());`,
      ],
      { cwd: root, env, encoding: "utf8" },
    );
  const initial = digest();
  git("add", ".");
  git(
    "-c",
    "commit.gpgsign=false",
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "-m",
    "fixture",
  );
  assert.equal(digest(), initial);
  writeFileSync(join(root, "receipt.json"), "ignored");
  assert.equal(digest(), initial);
  writeFileSync(join(root, "source.txt"), "changed");
  assert.notEqual(digest(), initial);
  writeFileSync(join(root, "source.txt"), "original");
  writeFileSync(join(root, "new.txt"), "new");
  assert.notEqual(digest(), initial);
  rmSync(join(root, "new.txt"));
  rmSync(join(root, "source.txt"));
  const deleted = digest();
  assert.notEqual(deleted, initial);
  git("add", "-u");
  assert.equal(digest(), deleted);
});
