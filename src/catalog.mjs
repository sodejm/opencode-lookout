import { isAbsolute, relative, resolve } from "node:path";
import { ID, validateID } from "./config.mjs";

/** Stable categories shared by the RPC, filters, and sidebar. */
export const KINDS = [
  "agent",
  "skill",
  "plugin",
  "mcp",
  "command",
  "provider",
  "model",
];
/**
 * Remove terminal control characters and bound untrusted display strings.
 * @param {unknown} value Untrusted display value.
 * @param {number} limit Maximum number of UTF-16 code units to display.
 * @returns {string} Plain text with no C0/C1 control characters.
 */
export function text(value, limit = 400) {
  return String(value ?? "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\x00-\x1f\x7f-\x9f]/g, " ")
    .slice(0, limit);
}
function inside(file, root) {
  if (!isAbsolute(file ?? "") || !isAbsolute(root ?? "")) return false;
  const r = relative(root, file);
  return !r.startsWith("..") && !isAbsolute(r);
}
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
 * @param {Array<any>} entries Public V2 records for that category.
 * @param {{configDir:string,home:string,config?:any}} scope Trusted local source boundaries.
 * @returns {Array<import('./types').Row>} Sanitized display and management metadata.
 */
export function normalize(kind, entries, { configDir, home, config = {} }) {
  const roots = [
    resolve(configDir, "skills"),
    resolve(home, ".agents/skills"),
    resolve(home, ".claude/skills"),
    ...(Array.isArray(config.skills)
      ? config.skills
      : (config.skills?.paths ?? [])
    )
      .filter(
        (p) => typeof p === "string" && (isAbsolute(p) || p.startsWith("~/")),
      )
      .map((p) => (p.startsWith("~/") ? resolve(home, p.slice(2)) : p)),
  ];
  const localMcp = config.mcp?.servers ?? config.mcp ?? {};
  return entries.map((item, index) => {
    const id =
      kind === "model"
        ? `${item.providerID}/${item.id}`
        : (item.id ?? item.name ?? `unidentified-${index}`);
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
      row.source = text(item.source?.type ?? "unknown");
      row.status = item.state?.status ?? "unknown";
      row.details = [
        `Parts: ${
          Object.keys(item.features ?? {})
            .filter((k) => item.features[k])
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
      row.status = item.status?.status ?? "unknown";
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
        `Variants: ${(item.variants ?? []).map((v) => text(v.id)).join(", ") || "default"}`,
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
        description: "",
        status: "not listed",
        source: "Control Center restriction",
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
      ? "disabled (Control Center)"
      : "restricted; still listed";
    row.reason =
      "Enable removes only the Control Center restriction. Other rules or unavailable sources may still block this item.";
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
