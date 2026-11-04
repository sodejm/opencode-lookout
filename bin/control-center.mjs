#!/usr/bin/env node
/** Offline lifecycle controls. Never require a running server, TUI, or credentials. */
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ID, lifecycle, owned, change, parseConfig } from "../src/config.mjs";
import { atomicUpdate, readConfig } from "../src/controller.mjs";

/** Resolve only the user's global config; fail rather than choose between two files. */
export async function configFile() {
  const directory = join(
    process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
    "opencode",
  );
  const files = [];
  for (const name of ["opencode.jsonc", "opencode.json"]) {
    const file = join(directory, name);
    if (
      await access(file).then(
        () => true,
        () => false,
      )
    )
      files.push(file);
  }
  if (files.length !== 1)
    throw new Error(
      "Expected exactly one global opencode.json or opencode.jsonc. No files changed.",
    );
  return files[0];
}

/**
 * load/unload changes only the marked package entry. restore removes all owned
 * resource restrictions and requires --yes because it can restore tool access.
 * Status describes disk configuration, not server or TUI readiness.
 */
export async function main(args = process.argv.slice(2)) {
  const [command = "status", confirmation] = args;
  if (
    !["load", "unload", "status", "restore"].includes(command) ||
    args.length > 2 ||
    (confirmation !== undefined &&
      (command !== "restore" || confirmation !== "--yes"))
  )
    throw new Error(
      "Usage: node bin/control-center.mjs [load|unload|status|restore --yes]",
    );
  if (command === "restore" && confirmation !== "--yes")
    throw new Error(
      "Restore removes every Control Center restriction globally. Repeat with restore --yes to confirm.",
    );
  const file = await configFile();
  const packagePath = dirname(dirname(fileURLToPath(import.meta.url)));
  if (command === "load" || command === "unload") {
    await atomicUpdate(file, null, (text) =>
      lifecycle(text, packagePath, command === "load"),
    );
    console.log(
      `Control Center ${command === "load" ? "load" : "unload"} configured. OpenCode watches this file; use /reload if needed.`,
    );
    if (command === "unload")
      console.log(
        "Resource restrictions were preserved. Use restore --yes separately to remove them.",
      );
  } else if (command === "restore") {
    await atomicUpdate(file, null, (text) =>
      owned(text).reduce((next, r) => change(next, r.kind, r.id, true), text),
    );
    console.log(
      "Removed Control Center restrictions only. Other policies and disabled settings remain unchanged.",
    );
  }
  const { text } = await readConfig(file);
  const plugins = parseConfig(text).plugins ?? [];
  console.log(
    `Package entry: ${plugins.includes(packagePath) ? "present" : plugins.includes("-" + ID) ? "disabled" : "not configured"}`,
  );
  console.log(`Owned restrictions: ${owned(text).length}`);
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(
      error?.code
        ? "Cannot access configuration safely. Check permissions; no credentials are needed."
        : error.message,
    );
    process.exitCode = 1;
  });
}
