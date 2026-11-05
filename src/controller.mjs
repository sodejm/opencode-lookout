import { open, lstat, rename, unlink } from "node:fs/promises";
import { constants } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { change, owned, parseConfig, validateID } from "./config.mjs";

/** @param {string} text Exact file bytes decoded as UTF-8. @returns {string} SHA-256 fingerprint. */
export const fingerprint = (text) =>
  createHash("sha256").update(text).digest("hex");
/**
 * Read one fixed config file without following a final-component symlink.
 * @param {string} file Trusted configuration path, never supplied by an RPC caller.
 * @returns {Promise<{text: string, mode: number}>} Validated text and original mode.
 */
export async function readConfig(file) {
  const stat = await lstat(file);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.nlink !== 1 ||
    stat.size > 1024 * 1024
  )
    throw new Error(
      "Configuration must be a regular, unlinked file smaller than 1 MiB.",
    );
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const actual = await handle.stat();
    if (actual.ino !== stat.ino || actual.dev !== stat.dev)
      throw new Error("Configuration changed; refresh and retry.");
    const text = await handle.readFile("utf8");
    parseConfig(text);
    return { text, mode: stat.mode & 0o777 };
  } finally {
    await handle.close();
  }
}
/**
 * Serialize extension writers and replace the config atomically.
 * Recheck before rename to detect external editors. A portable filesystem cannot
 * compare-and-swap against an uncooperative external writer; see the threat model.
 * @param {string} file Trusted config path.
 * @param {string|null} expected Required fingerprint, or null for an offline command.
 * @param {(text: string) => string} transform Pure transformation that returns valid JSONC.
 * @returns {Promise<void>}
 */
export async function atomicUpdate(file, expected, transform) {
  const lockPath = file + ".lookout-lock";
  let lock;
  try {
    lock = await open(lockPath, "wx", 0o600);
  } catch {
    throw new Error(
      "Another Lookout write is in progress; retry or inspect the stale lock.",
    );
  }
  const temp = file + `.lookout-${randomUUID()}.tmp`;
  try {
    const { text, mode } = await readConfig(file);
    if (expected && fingerprint(text) !== expected)
      throw new Error(
        "Configuration changed since preview; refresh and retry.",
      );
    const next = transform(text);
    parseConfig(next);
    if (next === text) return;
    const output = await open(temp, "wx", mode);
    try {
      await output.writeFile(next);
      await output.sync();
    } finally {
      await output.close();
    }
    if (fingerprint((await readConfig(file)).text) !== fingerprint(text))
      throw new Error("Configuration changed during write; nothing replaced.");
    await rename(temp, file);
  } finally {
    await unlink(temp).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
    await lock.close();
    await unlink(lockPath);
  }
}
/** Server-side preview/apply boundary. Tokens and history never contain config text. */
export class Controller {
  /**
   * @param {string} file Trusted global configuration path.
   * @param {() => Promise<Array<{kind:string,id:string,manageable:boolean}>>} catalog Fresh management eligibility.
   * @param {() => number} now Clock injected for deterministic expiration tests.
   */
  constructor(file, catalog, now = Date.now) {
    this.file = file;
    this.catalog = catalog;
    this.now = now;
    /** @type {Map<string, {input: import('./types').ChangeRequest, hash: string, expires: number}>} */
    this.pending = new Map();
    /** @type {Array<import('./types').ChangeRequest & {time:string}>} */
    this.history = [];
  }
  /** Recheck both the requested kind and current ownership or eligibility.
   * @param {import('./types').ChangeRequest} input Candidate change, revalidated at runtime.
   * @param {string} text Current configuration.
   */
  async authorize(input, text) {
    const { kind, id, enabled } = input;
    validateID(id);
    if (
      !["skill", "mcp", "plugin"].includes(kind) ||
      typeof enabled !== "boolean"
    )
      throw new Error("Unsupported control.");
    if (enabled) {
      if (!owned(text).some((r) => r.kind === kind && r.id === id))
        throw new Error("No owned restriction; this entry is read-only.");
    } else {
      const row = (await this.catalog()).find(
        (r) => r.kind === kind && r.id === id,
      );
      if (!row?.manageable)
        throw new Error(
          "Resource is missing or read-only; refresh before changing it.",
        );
    }
  }
  /** Validate without writing; issue one token bound to the request and file version.
   * @param {import('./types').ChangeRequest} input Requested resource restriction.
   */
  async preview(input) {
    const { text } = await readConfig(this.file);
    await this.authorize(input, text);
    change(text, input.kind, input.id, input.enabled); // Validate the exact prospective edit.
    this.pending.clear(); // A single outstanding preview per instance; bounded and short-lived.
    const token = randomUUID();
    this.pending.set(token, {
      input: { ...input },
      hash: fingerprint(text),
      expires: this.now() + 60_000,
    });
    return {
      token,
      summary: `${input.enabled ? "Remove Lookout restriction for" : "Disable"} ${input.kind} ${input.id}. Scope: global, every project using this server.\n${input.enabled ? "Other restrictions remain in force; this does not grant access." : "Existing conversations retain previously loaded content. Changes may affect other sessions."}\nOnly an exact-ID ${input.kind === "plugin" ? "plugin entry" : "deny policy"} is changed. OpenCode reloads configuration automatically.`,
    };
  }
  /** Consume a preview once, revalidate eligibility, and save only that change.
   * @param {string} token One-use preview token.
   */
  async apply(token) {
    const request = this.pending.get(token);
    this.pending.delete(token);
    if (!request || request.expires <= this.now())
      throw new Error("Preview expired or already used; preview again.");
    const { text } = await readConfig(this.file);
    if (fingerprint(text) !== request.hash)
      throw new Error("Configuration changed since preview; nothing changed.");
    await this.authorize(request.input, text);
    await atomicUpdate(this.file, request.hash, (s) =>
      change(s, request.input.kind, request.input.id, request.input.enabled),
    );
    this.history.push({
      ...request.input,
      time: new Date(this.now()).toISOString(),
    });
    this.history = this.history.slice(-20);
    return {
      saved: true,
      message:
        "Saved. Refresh to verify the effective state; higher-priority policies may override it.",
    };
  }
  /** Invalidate outstanding previews when the server plugin unloads. */
  dispose() {
    this.pending.clear();
  }
}
