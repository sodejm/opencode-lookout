import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

test("npm artifact contains only runtime code and public documentation", async () => {
  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(manifest.version, "0.1.2");
  assert.notEqual(manifest.private, true);
  assert.deepEqual(manifest.bin, { lookout: "bin/lookout.mjs" });
  assert.deepEqual(manifest.dependencies, { "jsonc-parser": "3.3.1" });
  assert.equal(
    manifest.peerDependencies["@opencode/plugin"],
    ">=2.2.1 <=2.2.6",
  );
  for (const name of ["@opencode/plugin", "solid-js"])
    assert.equal(manifest.peerDependenciesMeta[name].optional, true);
  for (const hook of [
    "preinstall",
    "install",
    "postinstall",
    "prepare",
    "prepack",
    "postpack",
    "prepublishOnly",
  ])
    assert.equal(manifest.scripts[hook], undefined);
  const [pack] = JSON.parse(
    execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
      encoding: "utf8",
    }),
  );
  const paths = pack.files.map((file) => file.path);
  for (const path of paths)
    assert.match(
      path,
      /^(?:src\/[\w.-]+\.(?:ts|tsx|mjs)|bin\/lookout\.mjs|dist\/tui\.js|package\.json|(?:README|LICENSE|CHANGELOG|SECURITY|SUPPORT|CONTRIBUTING|GOVERNANCE|CODE_OF_CONDUCT)\.md|LICENSE|docs\/[A-Z_]+\.md)$/,
    );
  assert(
    paths.includes("dist/tui.js"),
    "node_modules plugins need precompiled Solid JSX",
  );
  for (const entry of [...Object.values(manifest.exports), "./bin/lookout.mjs"])
    assert(paths.includes(entry.replace(/^\.\//, "")), `missing ${entry}`);
});
