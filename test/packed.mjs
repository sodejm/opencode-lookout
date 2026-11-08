/** Test the real consumer artifact without workspace links or developer dependencies. */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  access,
  realpath,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repository = fileURLToPath(new URL("../", import.meta.url));
const root = await realpath(await mkdtemp(join(tmpdir(), "lookout-packed-")));
try {
  const tarball = process.argv[2]
    ? resolve(process.argv[2])
    : join(
        root,
        JSON.parse(
          execFileSync(
            "npm",
            ["pack", "--json", "--ignore-scripts", "--pack-destination", root],
            { cwd: repository, encoding: "utf8" },
          ),
        )[0].filename,
      );
  const prefix = join(root, "consumer");
  await mkdir(prefix);
  // No root overrides: npm does not apply a dependency's overrides to consumers.
  execFileSync(
    "npm",
    [
      "install",
      "--prefix",
      prefix,
      "--omit=dev",
      "--ignore-scripts",
      "--no-fund",
      "--no-audit",
      tarball,
    ],
    { stdio: "pipe" },
  );
  execFileSync(
    process.execPath,
    [join(repository, "scripts/audit-consumer.mjs"), prefix],
    { stdio: "inherit" },
  );
  const installed = join(prefix, "node_modules/opencode-lookout");
  const manifest = JSON.parse(
    await readFile(join(installed, "package.json"), "utf8"),
  );
  assert.equal(manifest.name, "opencode-lookout");
  for (const path of [
    "test",
    ".github",
    ".vscode",
    "AGENTS.md",
    "opencode.json",
  ])
    await assert.rejects(access(join(installed, path)), { code: "ENOENT" });
  for (const dependency of [
    "typescript",
    "eslint",
    "@types/node",
    "@opencode/plugin",
    "@opentui/core",
    "@opentui/solid",
    "solid-js",
  ])
    await assert.rejects(access(join(prefix, "node_modules", dependency)), {
      code: "ENOENT",
    });
  const { change, owned, parseConfig } = await import(
    pathToFileURL(join(installed, "src/config.mjs"))
  );
  const directory = join(root, "config/opencode");
  await mkdir(directory, { recursive: true });
  const file = join(directory, "opencode.jsonc");
  const env = {
    PATH: process.env.PATH,
    HOME: root,
    XDG_CONFIG_HOME: join(root, "config"),
    XDG_DATA_HOME: join(root, "data"),
    XDG_CACHE_HOME: join(root, "cache"),
  };
  const executable = join(prefix, "node_modules/.bin/lookout");
  const cli = (...args) =>
    spawnSync(executable, args, {
      cwd: root,
      env,
      encoding: "utf8",
      timeout: 30000,
    });
  const direct = spawnSync(
    process.execPath,
    [join(installed, "bin/lookout.mjs"), "status"],
    { cwd: root, env, encoding: "utf8" },
  );
  assert.notEqual(
    direct.status,
    0,
    "direct checkout-compatible invocation still detects missing config",
  );
  const succeeds = (...args) => {
    const result = cli(...args);
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.match(
      result.stdout,
      /Owned restrictions:/,
      "npm bin must execute main, not silently return",
    );
    return result.stdout;
  };
  assert.notEqual(cli("load").status, 0, "missing config must fail");
  const original =
    '{"plugins":["unrelated"],"policies":[{"action":"tool.use","resource":"*","effect":"deny"}],"model":"keep/model"}';
  await writeFile(file, original);
  assert.match(succeeds("load"), /Package entry: present/);
  const status = spawnSync(
    process.execPath,
    [join(installed, "bin/lookout.mjs"), "status"],
    { cwd: root, env, encoding: "utf8" },
  );
  assert.equal(status.status, 0);
  assert.match(status.stdout, /Package entry: present/);
  const loaded = await readFile(file, "utf8");
  assert(parseConfig(loaded).plugins.includes(installed));
  succeeds("load");
  assert.equal(await readFile(file, "utf8"), loaded);
  const restricted = change(loaded, "skill", "fixture-skill", false);
  await writeFile(file, restricted);
  assert.match(succeeds("unload"), /Package entry: disabled/);
  assert.equal(owned(await readFile(file, "utf8")).length, 1);
  const unloaded = await readFile(file, "utf8");
  for (const args of [["restore"], ["load", "--yes"], ["invalid"]]) {
    assert.notEqual(cli(...args).status, 0);
    assert.equal(await readFile(file, "utf8"), unloaded);
  }
  succeeds("restore", "--yes");
  assert.equal(owned(await readFile(file, "utf8")).length, 0);
  succeeds("load");
  const recovered = parseConfig(await readFile(file, "utf8"));
  assert.equal(recovered.model, "keep/model");
  assert.deepEqual(recovered.policies, parseConfig(original).policies);
  assert(recovered.plugins.includes("unrelated"));
  await writeFile(join(directory, "opencode.json"), "{}");
  const before = await readFile(file, "utf8");
  assert.notEqual(cli("unload").status, 0, "ambiguous config must fail");
  assert.equal(await readFile(file, "utf8"), before);
  await rm(join(directory, "opencode.json"));
  await writeFile(file, "{broken");
  assert.notEqual(cli("load").status, 0);
  assert.equal(await readFile(file, "utf8"), "{broken");
  await writeFile(file, before.replace(installed, "/edited-by-user"));
  const edited = await readFile(file, "utf8");
  assert.notEqual(cli("unload").status, 0);
  assert.equal(await readFile(file, "utf8"), edited);
  console.log(
    `PASS packed ${manifest.name}@${manifest.version}: production install, consumer audit, npm bin, offline failure/recovery`,
  );
  if (process.env.LOOKOUT_PACKED_INTEGRATION === "1")
    execFileSync(process.execPath, [join(repository, "test/integration.mjs")], {
      cwd: repository,
      env: { ...process.env, LOOKOUT_PACKAGE_DIR: installed },
      stdio: "inherit",
      timeout: 240000,
    });
} finally {
  await rm(root, { recursive: true, force: true });
}
