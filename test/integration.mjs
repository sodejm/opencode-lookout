/**
 * Exercise real OpenCode without personal credentials or inference requests.
 * Every mutation targets a temporary HOME/XDG fixture. The child server is stopped
 * in finally; fixture files are retained only when LOOKOUT_KEEP_FIXTURE=1 is requested.
 */
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { lifecycle, owned } from "../src/config.mjs";

const harnessDir = resolve(fileURLToPath(new URL("../", import.meta.url)));
const packageDir = process.env.LOOKOUT_PACKAGE_DIR
  ? resolve(process.env.LOOKOUT_PACKAGE_DIR)
  : harnessDir;
const root = await mkdtemp(join(tmpdir(), "opencode-lookout-"));
const configDir = join(root, "config/opencode"),
  project = join(root, "project");
await mkdir(join(configDir, "skills/fixture-skill"), { recursive: true });
await mkdir(join(configDir, "plugins"), { recursive: true });
await mkdir(project, { recursive: true });
const file = join(configDir, "opencode.jsonc");
await writeFile(
  join(configDir, "skills/fixture-skill/SKILL.md"),
  "---\nname: Fixture skill\ndescription: Offline validation only\n---\nDo not execute tools.\n",
);
await writeFile(
  join(configDir, "plugins/widget.js"),
  `/** @description Offline fixture plugin. */\nexport default {id:'fixture.widget',setup(){}};\n`,
);
await writeFile(
  join(configDir, "plugins/undocumented.js"),
  `export default {id:'fixture.undocumented',setup(){}};\n`,
);
const original = {
  $schema: "https://opencode.ai/config.json",
  update: "disable",
  plugins: [],
  policies: [
    { action: "provider.use", resource: "*", effect: "deny" },
    { action: "tool.use", resource: "*", effect: "deny" },
  ],
  mcp: {
    servers: {
      fixture: {
        type: "local",
        command: [
          process.execPath,
          resolve(harnessDir, "test/fixtures/mcp-server.mjs"),
        ],
      },
    },
  },
};
await writeFile(
  file,
  lifecycle(JSON.stringify(original, null, 2), packageDir, true),
);
await writeFile(
  join(configDir, "cli.json"),
  JSON.stringify({
    theme: { name: process.env.LOOKOUT_THEME || "carbonfox" },
    session: { sidebar: "auto" },
    highlights: false,
  }),
);
const env = {
  PATH: process.env.PATH,
  HOME: root,
  XDG_CONFIG_HOME: join(root, "config"),
  XDG_DATA_HOME: join(root, "data"),
  XDG_CACHE_HOME: join(root, "cache"),
  TMPDIR: tmpdir(),
  TERM: "xterm-256color",
  LANG: "en_US.UTF-8",
};
const cliVersion = execFileSync("opencode", ["--version"], {
  env,
  encoding: "utf8",
})
  .trim()
  .replace(/^opencode v/, "");
if (process.env.LOOKOUT_EXPECTED_VERSION)
  assert.equal(
    cliVersion,
    process.env.LOOKOUT_EXPECTED_VERSION,
    "tested binary must match the requested artifact",
  );
// Deliberately explicit: unknown future versions do not become accepted read-only skips.
const readOnly = ["2.2.1", "2.2.2"].includes(cliVersion);
const server = spawn(
  "opencode",
  ["serve", "--hostname", "127.0.0.1", "--port", "0"],
  { cwd: project, env, stdio: ["ignore", "pipe", "pipe"] },
);
let output = "";
let lastRows = [];
server.stdout.on("data", (chunk) => (output += chunk));
server.stderr.on("data", (chunk) => (output += chunk));
async function until(fn, label, timeout = 30_000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (e) {
      last = e;
    }
    await delay(200);
  }
  throw new Error(`Timed out: ${label}${last ? ": " + last.message : ""}`);
}
try {
  const url = await until(
    () => output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0],
    "server startup",
  );
  const password = await until(
    () => output.match(/server password (\S+)/)?.[1],
    "test server credential",
  );
  env.OPENCODE_PASSWORD = password;
  // Ephemeral fixture credential; never print it or use the personal credential store.
  await writeFile(
    join(configDir, "service.json"),
    JSON.stringify({ password }),
    { mode: 0o600 },
  );
  const authorization =
    "Basic " + Buffer.from(`opencode:${password}`).toString("base64");
  const request = async (path, method = "GET", body) => {
    const response = await fetch(url + path, {
      method,
      headers: { "content-type": "application/json", authorization },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const bodyText = await response.text();
    const result = bodyText ? JSON.parse(bodyText) : undefined;
    if (!response.ok)
      throw new Error(`${path}: ${JSON.stringify(result).slice(0, 500)}`);
    return result;
  };
  const rpc = async (method, input = {}) =>
    (
      await request(`/api/rpc/opencode-lookout/${method}`, "POST", {
        input,
      })
    ).output;
  const snapshot = async () => {
    const result = await rpc("snapshot");
    // Allowlisted fixture diagnostics only; never print config or API payloads.
    lastRows = (result.rows ?? [])
      .filter((r) =>
        ["fixture-skill", "fixture", "fixture.widget"].includes(r.id),
      )
      .map(({ kind, id, status, owned, manageable }) => ({
        kind,
        id,
        status,
        owned,
        manageable,
      }));
    return result;
  };
  const first = await until(
    async () => {
      const s = await snapshot();
      return s.rows?.length ? s : false;
    },
    "extension registration",
    60_000,
  );
  if (readOnly) {
    assert.equal(first.errors.length, 1);
    assert.match(first.errors[0], /current policy API.*read-only/);
    assert(first.rows.every((row) => row.manageable === false));
  } else assert.deepEqual(first.errors, []);
  assert.equal(
    first.rows.find((r) => r.id === "fixture.widget").description,
    "Offline fixture plugin.",
  );
  assert.notEqual(
    first.rows.find((r) => r.id === "opencode-lookout").description,
    "missing description",
  );
  assert.equal(
    first.rows.find((r) => r.id === "fixture.undocumented").description,
    "missing description",
  );
  for (const [kind, id] of [
    ["skill", "fixture-skill"],
    ["mcp", "fixture"],
    ["plugin", "fixture.widget"],
  ]) {
    const row = first.rows.find((r) => r.kind === kind && r.id === id);
    if (readOnly) {
      assert(
        row && !row.manageable,
        `${kind} fixture must remain visible but read-only`,
      );
      await assert.rejects(rpc("preview", { kind, id, enabled: false }));
      await assert.rejects(rpc("preview", { kind, id, enabled: true }));
      await assert.rejects(rpc("apply", { token: "unsupported-host" }));
      console.log(
        `PASS ${kind}: read-only inventory; enable/disable/apply rejected`,
      );
      continue;
    }
    assert(row?.manageable, `${kind} fixture must be manageable`);
    const preview = await rpc("preview", { kind, id, enabled: false });
    assert(preview.token);
    await rpc("apply", { token: preview.token });
    await request("/api/location/reload", "POST");
    const disabled = await until(async () => {
      const s = await snapshot();
      return s.rows.find((r) => r.kind === kind && r.id === id)?.status ===
        "disabled (Lookout)"
        ? s
        : false;
    }, `${kind} effective disable`);
    assert(
      disabled.rows.some((r) => r.kind === kind && r.id === id && r.owned),
    );
    const enable = await rpc("preview", { kind, id, enabled: true });
    await rpc("apply", { token: enable.token });
    await request("/api/location/reload", "POST");
    await until(async () => {
      const s = await snapshot();
      return s.rows.some(
        (r) => r.kind === kind && r.id === id && !r.owned && r.manageable,
      );
    }, `${kind} effective enable`);
    console.log(
      `PASS ${kind}: confirmed disable, filtered row recovery, enable after reload`,
    );
  }
  assert.equal(owned(await readFile(file, "utf8")).length, 0);
  await assert.rejects(
    rpc("preview", {
      kind: "plugin",
      id: "opencode.config.policy",
      enabled: false,
    }),
  );
  await assert.rejects(
    rpc("preview", { kind: "agent", id: "build", enabled: false }),
  );
  console.log("PASS protected plugin and agent controls rejected");

  // Use the real offline CLI so recovery does not depend on an active RPC.
  const cli = (command) =>
    execFileSync(
      process.execPath,
      [join(packageDir, "bin/lookout.mjs"), command],
      { cwd: project, env, encoding: "utf8" },
    );
  cli("unload");
  await request("/api/location/reload", "POST");
  const unloaded = (await request("/api/plugin")).data;
  assert(!unloaded.some((p) => p.id === "opencode-lookout"));
  await assert.rejects(snapshot());
  cli("load");
  await request("/api/location/reload", "POST");
  await until(snapshot, "re-register after load");
  console.log("PASS offline unload removes RPC; load restores it");

  // Optional real terminal exercise. No prompt is submitted to a model.
  if (process.env.LOOKOUT_TUI === "1") {
    const session = await request("/api/session", "POST", {});
    // Keep the fixture response in memory; only its ID is needed by the terminal.
    const id = session.id ?? session.data?.id;
    assert(id, "session creation returned an ID");
    await assert.rejects(
      readFile(join(root, "session.json")),
      { code: "ENOENT" },
      "session responses must stay in memory",
    );
    const transcript = join(root, "terminal.log");
    execFileSync(
      "/usr/bin/expect",
      [
        join(harnessDir, "test/tui.exp"),
        url,
        id,
        transcript,
        process.env.LOOKOUT_NARROW || "0",
        readOnly ? "1" : "0",
        packageDir,
      ],
      { cwd: project, env, timeout: 90_000, stdio: "pipe" },
    );
    const terminal = await readFile(transcript, "utf8");
    assert(terminal.includes("Lookout"), "sidebar or dialog title rendered");
    assert(
      terminal.includes("Fixture skill"),
      "fixture skill rendered in catalog",
    );
    assert(!terminal.includes("TUI plugin failed"), "no plugin load failure");
    assert(
      !terminal.includes("MCP servers"),
      "no duplicate MCP inventory in Lookout",
    );
    if (process.env.LOOKOUT_NARROW !== "1")
      assert(
        terminal.includes("Connected"),
        "native MCP status remains visible",
      );
    if (process.env.LOOKOUT_NARROW !== "1")
      assert(
        terminal.includes("Offline fixture plugin."),
        "sidebar description comes from the fixture plugin file",
      );
    if (process.env.LOOKOUT_NARROW !== "1")
      assert(
        terminal.includes("missing description"),
        "sidebar uses the exact fallback for undocumented plugins",
      );
    const completed = await request(`/api/session/${id}`);
    assert.equal(
      (completed.data ?? completed).cost,
      0,
      "terminal test must not incur inference cost",
    );
    const afterTui = owned(await readFile(file, "utf8"));
    if (readOnly)
      assert.equal(
        afterTui.length,
        0,
        "read-only terminal cannot change restrictions",
      );
    else
      assert(
        afterTui.some((r) => r.kind === "skill" && r.id === "fixture-skill"),
        "TUI confirmation applied the skill restriction",
      );
    execFileSync(
      process.execPath,
      [join(packageDir, "bin/lookout.mjs"), "restore", "--yes"],
      { cwd: project, env, encoding: "utf8" },
    );
    await request("/api/location/reload", "POST");
    assert.equal(owned(await readFile(file, "utf8")).length, 0);
    console.log(
      readOnly
        ? "PASS terminal: read-only sidebar, search/category filter, details; no mutations"
        : "PASS terminal: sidebar, search/category filter, details, confirmed control, offline restore",
    );
  }
  console.log(
    "PASS isolated integration; no personal credentials or inference used",
  );
} catch (error) {
  console.error("Last fixture statuses:", JSON.stringify(lastRows));
  console.error(
    output
      .replace(/server password \S+/g, "server password [redacted]")
      .slice(-1600),
  );
  throw error;
} finally {
  server.kill("SIGTERM");
  await Promise.race([once(server, "exit"), delay(5000)]);
  if (server.exitCode === null && server.signalCode === null)
    server.kill("SIGKILL");
  if (process.env.LOOKOUT_KEEP_FIXTURE === "1")
    console.log(`Fixture retained: ${root}`);
  else await rm(root, { recursive: true, force: true });
}
