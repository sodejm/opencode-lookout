import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { readConfig } from "../src/controller.mjs";

async function fixture(t) {
  const root = await fs.mkdtemp(join(tmpdir(), "lookout-read-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = join(root, "config.jsonc");
  await fs.writeFile(file, "{}", { mode: 0o640 });
  return { root, file };
}

// Builtin mocks are scoped to this test process; no production injection API.
function onOpen(t, hook) {
  const open = fs.open;
  const mock = t.mock.method(fs, "open", async (...args) => {
    const handle = await open(...args);
    await hook(handle);
    return handle;
  });
  syncBuiltinESMExports();
  const restore = () => {
    mock.mock.restore();
    syncBuiltinESMExports();
  };
  t.after(restore);
  return restore;
}

for (const mutation of ["hard link", "growth"]) {
  test(`config read rejects ${mutation} introduced during open and recovers`, async (t) => {
    const { file } = await fixture(t);
    let opened;
    const restore = onOpen(t, async (handle) => {
      opened = handle;
      if (mutation === "hard link") await fs.link(file, file + ".linked");
      else await fs.appendFile(file, " ".repeat(1024 * 1024));
    });
    await assert.rejects(readConfig(file), /regular|1 MiB/);
    assert.equal(opened.fd, -1, "rejected handle must close");
    restore();
    if (mutation === "hard link") await fs.unlink(file + ".linked");
    await fs.writeFile(file, "{}");
    assert.equal((await readConfig(file)).text, "{}");
  });
}

test("config mode comes from the opened handle, not a stale path check", async (t) => {
  const { file } = await fixture(t);
  onOpen(t, (handle) => handle.chmod(0o600));
  assert.equal((await readConfig(file)).mode, 0o600);
});

test("reads handle short reads and reject growth after descriptor validation", async (t) => {
  const { file } = await fixture(t);
  await fs.writeFile(file, '{"unicode":"é"}');
  const restore = onOpen(t, (handle) => {
    const read = handle.read.bind(handle);
    t.mock.method(handle, "read", (buffer, offset, length, position) =>
      read(buffer, offset, Math.min(length, 3), position),
    );
  });
  assert.equal((await readConfig(file)).text, '{"unicode":"é"}');
  restore();
  let total = 0;
  let opened;
  onOpen(t, (handle) => {
    opened = handle;
    const read = handle.read.bind(handle);
    t.mock.method(handle, "read", async (...args) => {
      if (total === 0) await fs.appendFile(file, " ".repeat(2 * 1024 * 1024));
      const result = await read(...args);
      total += result.bytesRead;
      return result;
    });
  });
  await assert.rejects(readConfig(file), /1 MiB/);
  assert.equal(
    total,
    1024 * 1024 + 1,
    "read budget must remain bounded despite growth",
  );
  assert.equal(opened.fd, -1);
});

test("reads reject hard links introduced during the read and close on parse errors", async (t) => {
  const { file } = await fixture(t);
  let opened;
  const restore = onOpen(t, (handle) => {
    opened = handle;
    const read = handle.read.bind(handle);
    let changed = false;
    t.mock.method(handle, "read", async (...args) => {
      if (!changed) {
        await fs.link(file, file + ".linked");
        changed = true;
      }
      return read(...args);
    });
  });
  await assert.rejects(readConfig(file), /changed/);
  assert.equal(opened.fd, -1);
  restore();
  await fs.unlink(file + ".linked");
  await fs.writeFile(file, "invalid JSON");
  onOpen(t, (handle) => {
    opened = handle;
  });
  await assert.rejects(readConfig(file));
  assert.equal(opened.fd, -1);
});

test("config reads reject directories, FIFOs, and final symlinks without changing targets", async (t) => {
  const { root, file } = await fixture(t);
  const fifo = join(root, "pipe");
  execFileSync("mkfifo", [fifo]);
  await fs.symlink(file, file + ".symlink");
  for (const path of [root, fifo, file + ".symlink"])
    await assert.rejects(readConfig(path), /regular/);
  assert.equal(await fs.readFile(file, "utf8"), "{}");
});
