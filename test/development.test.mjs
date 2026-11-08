import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parse } from "jsonc-parser";
import { ID, change, lifecycle } from "../src/config.mjs";

test("npm publishing is manual, tag-scoped, and rechecks evidence before OIDC publication", async () => {
  const workflow = await readFile(".github/workflows/npm-publish.yml", "utf8");
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(
    workflow,
    /(?:^|\n)\s+(?:push|pull_request|pull_request_target|release|schedule):/,
  );
  assert.match(workflow, /environment: npm/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /startsWith\(github.ref, 'refs\/tags\/v'\)/);
  assert.equal(
    workflow.match(/node scripts\/npm-publish-check.mjs/g)?.length,
    2,
  );
  assert.match(workflow, /node scripts\/check-package-evidence.mjs/);
  assert.match(workflow, /npm publish .*--ignore-scripts .*--provenance/);
  assert.doesNotMatch(workflow, /NODE_AUTH_TOKEN|NPM_TOKEN|secrets\./);
});

test("required CodeQL checks come from full branch scans, never PR-only results", async () => {
  const workflow = await readFile(".github/workflows/codeql.yml", "utf8");
  assert.match(workflow, /branches: \["\*\*"\]/);
  assert.match(
    workflow,
    /github\.event_name == 'pull_request' && 'PR Analyze' \|\| 'Analyze'/,
  );
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /node scripts\/check-codeql\.mjs/);
});

test("canonical Lookout names cover ID, ownership, lifecycle, and recovery path", async () => {
  assert.equal(ID, "opencode-lookout");
  assert.match(
    change("{}", "skill", "review", false),
    /lookout:begin:policies/,
  );
  assert.match(lifecycle("{}", "/package", false), /-opencode-lookout/);
  assert.match(lifecycle("{}", "/package", false), /lookout:lifecycle/);
  assert.match(await readFile("bin/lookout.mjs", "utf8"), /bin\/lookout\.mjs/);
  assert.match(
    await readFile("src/tui.tsx", "utf8"),
    /slash: \{ name: "lookout"/,
  );
});

test("editor and agent adapters are portable and do not grant runtime authority", async () => {
  const json = async (path) => {
    const errors = [];
    const value = parse(await readFile(path, "utf8"), errors, {
      allowTrailingComma: true,
    });
    assert.deepEqual(errors, []);
    return value;
  };
  const config = await json("opencode.json");
  assert.deepEqual(Object.keys(config).sort(), ["$schema", "instructions"]);
  assert.deepEqual(config.instructions, ["AGENTS.md", "CONTRIBUTING.md"]);
  const manifest = await json("package.json");
  const tasks = await json(".vscode/tasks.json");
  for (const task of tasks.tasks) {
    assert.equal(task.type, "process");
    assert.equal(task.command, "npm");
    assert.equal(task.runOptions, undefined);
    if (task.args[0] === "run") assert(manifest.scripts[task.args[1]]);
    else assert(["ci", "test"].includes(task.args[0]));
    if (task.args[0] === "ci") assert(task.args.includes("--ignore-scripts"));
  }
  assert.deepEqual((await json("opencode-lookout.code-workspace")).folders, [
    { path: "." },
  ]);
  const copilot = await readFile(".github/copilot-instructions.md", "utf8");
  assert.match(copilot, /AGENTS\.md/);
  assert.match(copilot, /CONTRIBUTING\.md/);
});
