import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

test("npm artifact contains only runtime code and public documentation", async () => {
  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(manifest.version, "0.1.3");
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

test("npm package page metadata is complete and points at the reviewed source", async () => {
  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  const repository = "https://github.com/sodejm/opencode-lookout";
  assert.equal(manifest.repository?.type, "git");
  assert.equal(manifest.repository?.url, `git+${repository}.git`);
  assert.equal(manifest.homepage, `${repository}#readme`);
  assert.equal(manifest.bugs?.url, `${repository}/issues`);
  assert.equal(manifest.license, "MIT");
  assert.match(manifest.description, /\S/);
  assert(
    manifest.description.length <= 160,
    "npm search snippet must stay short",
  );
  assert.deepEqual([...manifest.keywords].sort(), [
    "developer-tools",
    "opencode",
    "opencode-plugin",
    "sidebar",
    "terminal",
    "tui",
  ]);
  assert.equal(manifest.engines?.node, ">=22");
  assert.equal(manifest.publishConfig?.access, "public");
  assert.match(manifest.author ?? "", /\S/);
  const [pack] = JSON.parse(
    execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
      encoding: "utf8",
    }),
  );
  const paths = pack.files.map((file) => file.path);
  for (const required of [
    "README.md",
    "LICENSE",
    "CHANGELOG.md",
    "src/server.ts",
  ])
    assert(paths.includes(required), `npm page needs ${required}`);
  const readme = await readFile("README.md", "utf8");
  assert.doesNotMatch(readme, /release candidate|after v0\.1\.2 is published/);
  assert.match(readme, /npm install --prefix .* opencode-lookout@0\.1\.3/);
});
