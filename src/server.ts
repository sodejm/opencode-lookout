/** @description A native-style resource sidebar with reversible local controls. */
import { Plugin } from "@opencode/plugin";
import type { PluginInfo } from "@opencode/client";
import { homedir } from "node:os";
import { join } from "node:path";
import { access } from "node:fs/promises";
import { ControlCenter } from "./rpc";
import { ID, owned, parseConfig } from "./config.mjs";
import { Controller, readConfig } from "./controller.mjs";
import { KINDS, normalize, mergeOwned } from "./catalog.mjs";
import { pluginDescription } from "./plugin-description.mjs";
import type { ChangeRequest, Row, Snapshot } from "./types";

/** Never return filesystem errors with paths, or provider errors with payloads. */
function safeError(error: unknown): string {
  if (error instanceof Error && !("code" in error))
    return error.message.slice(0, 300);
  return "Cannot access the global configuration safely. Check file permissions and run the external status command.";
}

export default Plugin.define({
  id: ID,
  async setup(ctx) {
    const home = homedir();
    const configDir = join(
      process.env.XDG_CONFIG_HOME || join(home, ".config"),
      "opencode",
    );
    const candidates = await Promise.all(
      ["opencode.jsonc", "opencode.json"].map(async (name) => {
        const file = join(configDir, name);
        return await access(file).then(
          () => file,
          () => null,
        );
      }),
    );
    const files = candidates.filter((p): p is string => p !== null);
    const file = files[0] ?? join(configDir, "opencode.jsonc");
    let disposed = false;
    const cache = new Map<string, Row[]>();

    /** Independent collection failures retain stale rows, but never permit edits. */
    async function snapshot(): Promise<Snapshot> {
      const errors: string[] = [];
      let config = {},
        restrictions: { kind: string; id: string }[] = [];
      try {
        if (files.length !== 1)
          throw new Error(
            "Use exactly one global opencode.json or opencode.jsonc to enable controls.",
          );
        const { text } = await readConfig(file);
        config = parseConfig(text);
        restrictions = owned(text);
      } catch (e) {
        errors.push(safeError(e));
      }
      const scope = { configDir, home, config };
      const sources = [
        ctx.agent,
        ctx.skill,
        ctx.plugin,
        ctx.mcp,
        ctx.command,
        ctx.provider,
        ctx.model,
      ];
      const results = await Promise.allSettled(
        sources.map((source) => source.list()),
      );
      const rows: Row[] = [];
      for (const [index, result] of results.entries()) {
        const kind = KINDS[index];
        if (result.status === "fulfilled") {
          const batch = normalize(kind, result.value.data, scope) as Row[];
          if (kind === "plugin") {
            await Promise.all(
              batch.map(async (row, index) => {
                row.description = await pluginDescription(
                  (result.value.data[index] as PluginInfo).source,
                );
              }),
            );
          }
          if (!disposed) cache.set(kind, batch);
          rows.push(...batch);
        } else {
          errors.push(
            `${kind} inventory unavailable; showing last snapshot, if any.`,
          );
          rows.push(
            ...(cache.get(kind) ?? []).map((r) => ({
              ...r,
              status: "stale",
              manageable: false,
            })),
          );
        }
      }
      const merged = mergeOwned(rows, restrictions) as Row[];
      if (errors.length)
        merged.forEach((r) => {
          r.manageable = false;
          r.reason = "Refresh successfully before changing configuration.";
        });
      return {
        rows: merged,
        errors,
        location: ctx.location.directory,
        refreshedAt: new Date().toISOString(),
      };
    }
    const controller = new Controller(file, async () => {
      const result = await snapshot();
      if (result.errors.length)
        throw new Error(
          "Inventory incomplete; configuration controls are read-only.",
        );
      return result.rows;
    });
    const registration = await ctx.rpc.register(ControlCenter, {
      snapshot: async () => snapshot(),
      preview: async (input, call) => {
        try {
          if (disposed || files.length !== 1)
            throw new Error("Configuration controller is unavailable.");
          return await controller.preview(input as ChangeRequest);
        } catch (e) {
          return call.error("rejected", safeError(e), {});
        }
      },
      apply: async (input, call) => {
        try {
          if (disposed)
            throw new Error("Configuration controller was unloaded; refresh.");
          return await controller.apply((input as { token: string }).token);
        } catch (e) {
          return call.error("rejected", safeError(e), {});
        }
      },
    });
    return async () => {
      disposed = true;
      controller.dispose();
      cache.clear();
      await registration.dispose();
    };
  },
});
