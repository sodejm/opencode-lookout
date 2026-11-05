import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { extname, isAbsolute, join } from "node:path";
import { text } from "./catalog.mjs";

const missing = "missing description";

/** Read only bounded regular files; never execute plugin code or follow a file symlink.
 * @param {string} file Catalog-selected local file.
 * @param {number} limit Maximum bytes to read.
 * @param {boolean} prefixOnly Allow reading just a bounded header from a larger source.
 */
async function readMetadata(file, limit, prefixOnly = false) {
  const handle = await open(
    file,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || (!prefixOnly && stat.size > limit)) return "";
    const buffer = Buffer.alloc(limit);
    const { bytesRead } = await handle.read(buffer, 0, limit, 0);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

/** Read an explicit description tag from the leading JSDoc block, not tool metadata.
 * @param {string} source Bounded file prefix; never evaluated.
 */
function headerDescription(source) {
  const header = source.match(
    /^\uFEFF?(?:#![^\n]*\n)?\s*\/\*\*([\s\S]*?)\*\//,
  )?.[1];
  if (!header) return "";
  const lines = header
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\*?\s?/, "").trim());
  const start = lines.findIndex((line) => /^@description(?:\s|$)/.test(line));
  if (start < 0) return "";
  const description = [lines[start].replace(/^@description\s*/, "")];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("@")) break;
    description.push(line);
  }
  return description.filter(Boolean).join(" ");
}

/**
 * Read a description from the catalog's exact local plugin source. Directories
 * use package.json; single-file plugins use a leading JSDoc @description tag.
 * No ancestor lookup, registry requests, imports, or ID-to-description table.
 * @param {{type?:string,path?:string}|undefined} source Server-owned source metadata.
 * @returns {Promise<string>} Sanitized description or the literal fallback.
 */
export async function pluginDescription(source) {
  if (
    source?.type !== "local" ||
    typeof source.path !== "string" ||
    !isAbsolute(source.path)
  )
    return missing;
  try {
    const stat = await lstat(source.path);
    let description;
    if (stat.isDirectory()) {
      const manifest = await readMetadata(
        join(source.path, "package.json"),
        64 * 1024,
      );
      description = JSON.parse(manifest).description;
    } else if (
      stat.isFile() &&
      [".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"].includes(
        extname(source.path),
      )
    ) {
      description = headerDescription(
        await readMetadata(source.path, 16 * 1024, true),
      );
    }
    return typeof description === "string"
      ? text(description.trim()).trim() || missing
      : missing;
  } catch {
    // Missing/unreadable metadata must not break inventory or disclose local paths.
    return missing;
  }
}
