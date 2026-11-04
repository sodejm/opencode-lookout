import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Controller, atomicUpdate } from "../src/controller.mjs";
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "cc-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "opencode.jsonc");
  await writeFile(file, '{"policies":[],"plugins":[]}');
  let rows = [{ kind: "skill", id: "review", manageable: true }];
  let now = 100;
  const c = new Controller(
    file,
    async () => rows,
    () => now,
  );
  return { file, c, setRows: (r) => (rows = r), setNow: (n) => (now = n) };
}
test("preview does not write; apply requires one-use token, enable removes only owned restriction", async (t) => {
  const { file, c, setRows } = await fixture(t);
  const initial = await readFile(file, "utf8");
  const preview = await c.preview({
    kind: "skill",
    id: "review",
    enabled: false,
  });
  assert.equal(await readFile(file, "utf8"), initial);
  await assert.rejects(c.apply("bad"));
  await c.apply(preview.token);
  await assert.rejects(c.apply(preview.token));
  setRows([]); // Denied skills disappear from the server catalog.
  const restore = await c.preview({
    kind: "skill",
    id: "review",
    enabled: true,
  });
  await c.apply(restore.token);
  assert.equal(await readFile(file, "utf8"), initial);
});
test("stale config, expired token and changed catalog all fail closed", async (t) => {
  const { file, c, setRows, setNow } = await fixture(t);
  let preview = await c.preview({
    kind: "skill",
    id: "review",
    enabled: false,
  });
  await writeFile(file, '{"model":"keep/me"}');
  await assert.rejects(c.apply(preview.token), /changed/);
  assert.equal(await readFile(file, "utf8"), '{"model":"keep/me"}');
  preview = await c.preview({ kind: "skill", id: "review", enabled: false });
  setNow(100_000);
  await assert.rejects(c.apply(preview.token), /expired/);
  preview = await c.preview({ kind: "skill", id: "review", enabled: false });
  setRows([{ kind: "skill", id: "review", manageable: false }]);
  await assert.rejects(c.apply(preview.token), /read-only/);
});
test("symlinks and concurrent writes are rejected; failures leave original readable", async (t) => {
  const { file } = await fixture(t);
  const link = file + ".link";
  await symlink(file, link);
  await assert.rejects(
    atomicUpdate(link, null, (s) => s + " "),
    /regular/,
  );
  const initial = await readFile(file, "utf8");
  await writeFile(file + ".cc-lock", "busy");
  await assert.rejects(
    atomicUpdate(file, null, (s) => s + " "),
    /Another/,
  );
  assert.equal(await readFile(file, "utf8"), initial);
  await rm(file + ".cc-lock");
  await assert.rejects(
    atomicUpdate(file, null, () => {
      throw new Error("test failure");
    }),
  );
  assert.equal(await readFile(file, "utf8"), initial);
  await atomicUpdate(file, null, (s) => s + " ");
});
test("arbitrary kind, unknown resource, external disable cannot be elevated", async (t) => {
  const { c } = await fixture(t);
  for (const request of [
    { kind: "agent", id: "build", enabled: false },
    { kind: "skill", id: "unknown", enabled: false },
    { kind: "skill", id: "review", enabled: true },
  ])
    await assert.rejects(c.preview(request));
});
