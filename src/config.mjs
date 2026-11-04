import {
  parseTree,
  getNodeValue,
  findNodeAtLocation,
  modify,
  applyEdits,
} from "jsonc-parser";

/** Shared server/TUI plugin ID, also used by the offline unload command. */
export const ID = "personal.control-center";
const begin = (key) => `/* cc:begin:${key} */`;
const end = (key) => `/* cc:end:${key} */`;
/**
 * Reject policy wildcards and control characters instead of escaping them.
 * @param {string} id Exact catalog resource ID.
 * @throws {Error} If the ID cannot safely be used in an exact policy rule.
 */
export function validateID(id) {
  if (
    typeof id !== "string" ||
    !/^[a-zA-Z0-9_][a-zA-Z0-9_.:/@-]{0,199}$/.test(id)
  )
    throw new Error("Only exact resource IDs without wildcards are supported.");
}
/** Validate syntax and duplicate keys before any transformation. */
function tree(text) {
  const errors = [];
  const root = parseTree(text, errors, { allowTrailingComma: true });
  if (errors.length || root?.type !== "object")
    throw new Error("Invalid JSONC configuration; nothing changed.");
  function visit(node) {
    if (node.type === "object") {
      const keys = node.children.map((p) => p.children[0].value);
      if (new Set(keys).size !== keys.length)
        throw new Error("Duplicate configuration keys; nothing changed.");
    }
    node.children?.forEach(visit);
  }
  visit(root);
  for (const key of ["plugins", "policies"]) {
    const node = findNodeAtLocation(root, [key]);
    if (node && node.type !== "array")
      throw new Error(`${key} must be an array; nothing changed.`);
  }
  return root;
}
/** @param {string} text JSONC source. @returns {Record<string, any>} Validated configuration. */
export const parseConfig = (text) => getNodeValue(tree(text));

/** Parse only our canonical tail block. Hand-edited blocks must fail closed. */
function block(text, key) {
  const root = tree(text),
    start = text.indexOf(begin(key)),
    stop = text.indexOf(end(key));
  if (start === -1 && stop === -1) return { values: [], start: -1, stop: -1 };
  if (
    start < 0 ||
    stop < start ||
    text.indexOf(begin(key), start + 1) !== -1 ||
    text.indexOf(end(key), stop + 1) !== -1
  )
    throw new Error("Damaged Control Center markers; nothing changed.");
  const array = findNodeAtLocation(root, [key]);
  if (
    !array ||
    start <= array.offset ||
    stop >= array.offset + array.length ||
    text.slice(stop + end(key).length, array.offset + array.length - 1).trim()
  )
    throw new Error("Moved Control Center block; nothing changed.");
  const values = array.children
    .filter((n) => n.offset > start && n.offset < stop)
    .map(getNodeValue);
  for (const v of values) {
    if (key === "plugins") {
      if (typeof v !== "string" || !v.startsWith("-"))
        throw new Error("Modified owned plugin entry.");
      validateID(v.slice(1));
    } else {
      if (
        !["skill.use", "mcp.use"].includes(v.action) ||
        v.effect !== "deny" ||
        Object.keys(v).sort().join() !== "action,effect,resource"
      )
        throw new Error("Modified owned policy entry.");
      validateID(v.resource);
    }
  }
  // Only whitespace, our comma and owned values are allowed inside the block.
  const fragment = text
    .slice(start + begin(key).length, stop)
    .trim()
    .replace(/^,/, "")
    .trim();
  if (fragment !== values.map((v) => JSON.stringify(v)).join(", "))
    throw new Error("Edited Control Center block; nothing changed.");
  return { values, start, stop: stop + end(key).length };
}
/**
 * Recover exact-ID restrictions without needing the filtered server catalog.
 * @param {string} text Global JSONC configuration.
 * @returns {{kind: string, id: string}[]} Restrictions owned by this extension.
 */
export function owned(text) {
  return [
    ...block(text, "policies").values.map((v) => ({
      kind: v.action === "skill.use" ? "skill" : "mcp",
      id: v.resource,
    })),
    ...block(text, "plugins").values.map((v) => ({
      kind: "plugin",
      id: v.slice(1),
    })),
  ];
}
/** Replace only marked bytes; leave external entries and comments intact. */
function replaceBlock(text, key, values) {
  const current = block(text, key);
  if (current.start !== -1)
    text = text.slice(0, current.start) + text.slice(current.stop);
  if (!values.length) {
    tree(text);
    return text;
  }
  if (!findNodeAtLocation(tree(text), [key]))
    text = applyEdits(
      text,
      modify(text, [key], [], {
        formattingOptions: { insertSpaces: true, tabSize: 2 },
      }),
    );
  const array = findNodeAtLocation(tree(text), [key]);
  const offset = array.offset + array.length - 1;
  const last = array.children.at(-1);
  // Check trailing comma via scanner-free parsing of the between-nodes region.
  const tail = last
    ? text
        .slice(last.offset + last.length, offset)
        .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "")
    : "";
  const comma = last && !tail.includes(",") ? ", " : "";
  const content = `${begin(key)}${comma}${values.map((v) => JSON.stringify(v)).join(", ")}${end(key)}`;
  const next = text.slice(0, offset) + content + text.slice(offset);
  tree(next);
  return next;
}
/**
 * Compute a reversible restriction change; this function performs no I/O.
 * @param {string} text Current global JSONC configuration.
 * @param {string} kind One of skill, mcp, or plugin.
 * @param {string} id Exact resource ID from a validated inventory.
 * @param {boolean} enabled True removes our denial; false adds one.
 * @returns {string} Valid JSONC with only the owned array block changed.
 * @throws {Error} For unsupported controls, protected IDs, or edited blocks.
 */
export function change(text, kind, id, enabled) {
  validateID(id);
  if (
    !["skill", "mcp", "plugin"].includes(kind) ||
    typeof enabled !== "boolean"
  )
    throw new Error("Unsupported control.");
  if (kind === "plugin" && (id === ID || id.startsWith("opencode.")))
    throw new Error(
      "Protected plugin; use the external lifecycle command for Control Center.",
    );
  const key = kind === "plugin" ? "plugins" : "policies";
  const all = owned(text);
  const exists = all.some((v) => v.kind === kind && v.id === id);
  if (enabled && !exists)
    throw new Error(
      "No Control Center restriction to remove. Existing external rules remain authoritative.",
    );
  const next = all.filter((v) => !(v.kind === kind && v.id === id));
  if (!enabled) next.push({ kind, id });
  next.sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`));
  const values =
    key === "plugins"
      ? next.filter((v) => v.kind === "plugin").map((v) => `-${v.id}`)
      : next
          .filter((v) => v.kind !== "plugin")
          .map((v) => ({
            action: `${v.kind}.use`,
            resource: v.id,
            effect: "deny",
          }));
  return replaceBlock(text, key, values);
}

/**
 * Update the separate lifecycle entry without touching resource restrictions.
 * @param {string} text Existing global JSONC configuration.
 * @param {string} packagePath Trusted path derived from the installed CLI file.
 * @param {boolean} enable Whether to load this package.
 * @returns {string} Updated configuration; the caller owns atomic persistence.
 */
export function lifecycle(text, packagePath, enable) {
  const marker = "/* cc:lifecycle */";
  tree(text);
  if (!findNodeAtLocation(tree(text), ["plugins"]))
    text = applyEdits(
      text,
      modify(text, ["plugins"], [], {
        formattingOptions: { insertSpaces: true, tabSize: 2 },
      }),
    );
  const array = findNodeAtLocation(tree(text), ["plugins"]);
  const desired = enable ? packagePath : `-${ID}`;
  const index = text.indexOf(marker);
  if (index !== -1) {
    if (text.indexOf(marker, index + 1) !== -1)
      throw new Error("Duplicate lifecycle marker.");
    const node = array.children.find(
      (n) =>
        n.offset + n.length <= index &&
        !text.slice(n.offset + n.length, index).trim(),
    );
    if (!node || ![packagePath, `-${ID}`].includes(node.value))
      throw new Error("Edited lifecycle entry; nothing changed.");
    return (
      text.slice(0, node.offset) +
      JSON.stringify(desired) +
      text.slice(node.offset + node.length)
    );
  }
  const pos = array.offset + 1;
  // Inserting at the front leaves the resource-control block at the end untouched.
  return (
    text.slice(0, pos) +
    `${JSON.stringify(desired)} ${marker}${array.children.length ? ", " : ""}` +
    text.slice(pos)
  );
}
