import { isAbsolute, relative, resolve } from "node:path";
import { ID, validateID } from "./config.mjs";

/** Stable RPC categories, including MCP for compatibility and restriction recovery. */
export const KINDS = [
  "agent",
  "skill",
  "plugin",
  "mcp",
  "command",
  "provider",
  "model",
];
/** Leave MCP browsing to the native sidebar and /mcps dialog. */
export const BROWSE_KINDS = KINDS.filter((kind) => kind !== "mcp");

/**
 * Limit all Lookout views, including search and saved pins, to its categories.
 * @param {Array<import('./types').Row>} rows Unmodified server snapshot.
 * @returns {Array<import('./types').Row>} Rows for the sidebar and browser.
 */
export function displayRows(rows) {
  return rows.filter((row) => BROWSE_KINDS.includes(row.kind));
}

/**
 * Select native semantic colors without treating catalog availability as health.
 * @param {{status:string}} row Normalized catalog status.
 * @param {boolean} stale Whether the current snapshot is incomplete or unavailable.
 * @returns {'success'|'warning'|'error'|'muted'} Theme role for the status dot.
 */
export function statusTone(row, stale = false) {
  if (stale) return "warning";
  if (row.status === "failed") return "error";
  if (["active", "available", "connected"].includes(row.status))
    return "success";
  if (
    [
      "unknown",
      "stale",
      "pending",
      "needs_auth",
      "restricted; still listed",
    ].includes(row.status)
  )
    return "warning";
  return "muted";
}
/**
 * Remove terminal control characters and bound untrusted display strings.
 * @param {unknown} value Untrusted display value.
 * @param {number} limit Maximum number of UTF-16 code units to display.
 * @returns {string} Plain text with no C0/C1 control characters.
 */
export function text(value, limit = 400) {
  return (
    String(value ?? "")
      // ANSI and C0/C1 removal is intentional security filtering, not a regex typo.
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f\x7f-\x9f]/g, " ")
      .slice(0, limit)
  );
}
/** @param {string | undefined} file Catalog path. @param {string} root Trusted source root. */
function inside(file, root) {
  if (!file || !isAbsolute(file) || !isAbsolute(root)) return false;
  const r = relative(root, file);
  return !r.startsWith("..") && !isAbsolute(r);
}
/** @param {string} id Catalog ID, validated before use in a policy. */
function exact(id) {
  try {
    validateID(id);
    return true;
  } catch {
    return false;
  }
}
/**
 * Produce a display allowlist, never a copy of an API response. In particular,
 * omit prompts, skill bodies, credentials, request headers, and MCP commands.
 * Management is limited to resources explicitly sourced from this user's config.
 * @param {string} kind Catalog category from KINDS.
 * @param {import('./types').CatalogEntry[]} entries Minimal public V2 record projection.
 * @param {{configDir:string,home:string,config?:Record<string, unknown>}} scope Trusted local source boundaries.
 * @returns {Array<import('./types').Row>} Sanitized display and management metadata.
 */
export function normalize(kind, entries, { configDir, home, config = {} }) {
  const skills = config.skills;
  const paths = Array.isArray(skills)
    ? skills
    : skills &&
        typeof skills === "object" &&
        "paths" in skills &&
        Array.isArray(skills.paths)
      ? skills.paths
      : [];
  const roots = [
    resolve(configDir, "skills"),
    resolve(home, ".agents/skills"),
    resolve(home, ".claude/skills"),
    ...paths
      .filter(
        (/** @type {string} */ p) =>
          typeof p === "string" && (isAbsolute(p) || p.startsWith("~/")),
      )
      .map((/** @type {string} */ p) =>
        p.startsWith("~/") ? resolve(home, p.slice(2)) : p,
      ),
  ];
  const mcp = config.mcp && typeof config.mcp === "object" ? config.mcp : {};
  const localMcp =
    "servers" in mcp && mcp.servers && typeof mcp.servers === "object"
      ? mcp.servers
      : mcp;
  return entries.map((item, index) => {
    const id =
      kind === "model"
        ? `${item.providerID}/${item.id}`
        : (item.id ?? item.name ?? `unidentified-${index}`);
    /** @type {import('./types').Row} */
    const row = {
      kind,
      id,
      label: text(item.name ?? item.title ?? id),
      description: text(item.description),
      status: "available",
      source: "Server catalog",
      manageable: false,
      owned: false,
      reason: "Read-only. Use native OpenCode controls.",
      details: [],
    };
    if (kind === "agent") {
      row.status = item.hidden ? "hidden" : "available";
      row.details = [
        `Mode: ${text(item.mode)}`,
        `Model: ${item.model ? text(`${item.model.providerID}/${item.model.id}#${item.model.variant ?? "default"}`) : "inherited"}`,
      ];
      row.reason =
        "Agents have no enabled flag. Use /agents to select an agent.";
    } else if (kind === "skill") {
      row.source = roots.some((r) => inside(item.path, r))
        ? "Local skill source"
        : "Other or managed source";
      row.manageable = row.source === "Local skill source" && exact(id);
      row.details = [
        `Auto-invocation: ${item.autoinvoke === false ? "off" : "on when described"}`,
      ];
    } else if (kind === "plugin") {
      // The server replaces this only with metadata read from the plugin's files.
      row.description = "missing description";
      row.source = text(item.source?.type ?? "unknown");
      row.status = item.state?.status ?? "unknown";
      row.details = [
        `Parts: ${
          Object.keys(item.features ?? {})
            .filter((k) => item.features?.[k])
            .join(", ") || "unknown"
        }`,
      ];
      row.manageable =
        item.source?.type === "local" &&
        inside(item.source.path, configDir) &&
        exact(id) &&
        id !== ID &&
        !id.startsWith("opencode.");
      if (item.source?.type === "builtin")
        row.reason = "Built-in plugins are protected in this extension.";
    } else if (kind === "mcp") {
      row.status =
        typeof item.status === "object" ? item.status.status : "unknown";
      row.source =
        Object.hasOwn(localMcp, id) && !item.integrationID
          ? "Global configuration"
          : "Other or managed source";
      row.manageable =
        row.source === "Global configuration" &&
        exact(id) &&
        row.status !== "disabled";
    } else if (kind === "provider") {
      row.status = item.activation ?? "available";
      row.details = [`Integration: ${text(item.integrationID ?? "unknown")}`];
    } else if (kind === "model") {
      row.status = item.enabled === false ? "disabled" : "available";
      row.details = [
        `Variants: ${(item.variants ?? []).map((/** @type {{id:string}} */ v) => text(v.id)).join(", ") || "default"}`,
        `Context: ${item.limit?.context ?? "unknown"}; output: ${item.limit?.output ?? "unknown"}`,
        `Tools: ${item.capabilities?.tools ? "yes" : "no"}`,
      ];
    }
    if (row.manageable)
      row.reason =
        "Exact-ID global restriction; confirmation required. Other sessions can be affected.";
    return row;
  });
}
/**
 * Restore disabled rows that policy filtering removes from the live catalog.
 * @param {Array<import('./types').Row>} rows Current normalized inventory.
 * @param {{kind:string,id:string}[]} restrictions Validated owned config entries.
 * @returns {Array<import('./types').Row>} Inventory including re-enable controls.
 */
export function mergeOwned(rows, restrictions) {
  const result = rows.map((r) => ({ ...r, details: [...r.details] }));
  for (const { kind, id } of restrictions) {
    let row = result.find((r) => r.kind === kind && r.id === id);
    if (!row) {
      row = {
        kind,
        id,
        label: text(id),
        description: kind === "plugin" ? "missing description" : "",
        status: "not listed",
        source: "Lookout restriction",
        details: [],
        manageable: true,
        owned: true,
        reason: "",
      };
      result.push(row);
    }
    row.owned = true;
    row.manageable = true;
    row.status = ["not listed", "disabled"].includes(row.status)
      ? "disabled (Lookout)"
      : "restricted; still listed";
    row.reason =
      "Enable removes only the Lookout restriction. Other rules or unavailable sources may still block this item.";
  }
  return result;
}
/**
 * Filter by kind, state, and literal search terms; never evaluate a user regex.
 * @param {Array<import('./types').Row>} rows Normalized inventory.
 * @param {{kind?:string,state?:string,query?:string}} options Composable filters.
 * @returns {Array<import('./types').Row>} Stable label/ID order, owned entries first.
 */
export function filterRows(
  rows,
  { kind = "all", state = "all", query = "" } = {},
) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return rows
    .filter(
      (r) =>
        (kind === "all" || r.kind === kind) &&
        (state === "all" ||
          (state === "managed"
            ? r.manageable
            : state === "disabled"
              ? r.owned || r.status.includes("disabled")
              : state === "errors"
                ? ["failed", "unknown", "stale"].includes(r.status)
                : state === "local"
                  ? [
                      "local",
                      "Local skill source",
                      "Global configuration",
                    ].includes(r.source)
                  : false)) &&
        terms.every((term) =>
          [r.id, r.label, r.description, r.source, r.status, ...r.details]
            .join(" ")
            .toLowerCase()
            .includes(term),
        ),
    )
    .sort(
      (a, b) =>
        Number(b.owned) - Number(a.owned) ||
        Number(b.manageable) - Number(a.manageable) ||
        a.label.localeCompare(b.label) ||
        a.id.localeCompare(b.id),
    );
}
