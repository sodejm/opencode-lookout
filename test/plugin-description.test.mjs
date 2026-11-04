import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pluginDescription } from "../src/plugin-description.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "lookout-description-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("package descriptions come from that plugin's manifest and reflect edits", async (t) => {
  const root = await fixture(t);
  const source = { type: "local", path: root };
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({
      description: "First description",
      token: "DO_NOT_RETURN",
    }),
  );
  assert.equal(await pluginDescription(source), "First description");
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ description: "Updated description" }),
  );
  assert.equal(await pluginDescription(source), "Updated description");
});

test("single-file plugins use only the leading JSDoc description without evaluation", async (t) => {
  const root = await fixture(t),
    file = join(root, "plugin.js");
  await writeFile(
    file,
    `/**
 * @description Describe this plugin.
 * Continue the description.
 * @author Do not include this tag
 */
throw new Error("Plugin source must never be executed");
const tool = {description:"Do not use a tool description"};`,
  );
  assert.equal(
    await pluginDescription({ type: "local", path: file }),
    "Describe this plugin. Continue the description.",
  );
  await writeFile(
    file,
    `export default {description:"Not the supported metadata format"};`,
  );
  assert.equal(
    await pluginDescription({ type: "local", path: file }),
    "missing description",
  );
});

test("missing, malformed, oversized and unsupported metadata use the exact fallback", async (t) => {
  const root = await fixture(t);
  for (const value of [
    undefined,
    {},
    { type: "builtin" },
    { type: "package", target: "unknown" },
    { type: "local", path: "relative.js" },
    { type: "local", path: join(root, "missing.js") },
  ])
    assert.equal(await pluginDescription(value), "missing description");
  for (const value of [
    "{broken",
    "{}",
    '{"description":42}',
    '{"description":"   "}',
    JSON.stringify({ description: "x".repeat(70000) }),
  ]) {
    await writeFile(join(root, "package.json"), value);
    assert.equal(
      await pluginDescription({ type: "local", path: root }),
      "missing description",
    );
  }
  const child = join(root, "child");
  await mkdir(child);
  assert.equal(
    await pluginDescription({ type: "local", path: child }),
    "missing description",
    "must not inherit an ancestor package's metadata",
  );
});

test("metadata is sanitized, bounded, and does not follow final-component symlinks", async (t) => {
  const root = await fixture(t),
    file = join(root, "plugin.js");
  await writeFile(file, "/** @description \x1b[31mSafe\x00 text */");
  assert.equal(
    await pluginDescription({ type: "local", path: file }),
    "Safe  text",
  );
  await writeFile(file, "/** @description " + "x".repeat(500) + " */");
  assert.equal(
    (await pluginDescription({ type: "local", path: file })).length,
    400,
  );
  const link = join(root, "link.js");
  await symlink(file, link);
  assert.equal(
    await pluginDescription({ type: "local", path: link }),
    "missing description",
  );
});
