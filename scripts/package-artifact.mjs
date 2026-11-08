/** Identify the npm artifact separately from the repository source digest. */
import { output } from "./release-io.mjs";

/**
 * @param {string} [directory] Write the tarball here, otherwise inspect a dry pack.
 * @returns {{filename:string, integrity:string}} Validated npm pack metadata.
 */
export function packageArtifact(directory) {
  const [pack] = JSON.parse(
    output("npm", [
      "pack",
      "--ignore-scripts",
      "--json",
      ...(directory ? ["--pack-destination", directory] : ["--dry-run"]),
    ]),
  );
  if (
    !/^opencode-lookout-\d+\.\d+\.\d+\.tgz$/.test(pack?.filename ?? "") ||
    !/^sha512-[A-Za-z0-9+/]{86}==$/.test(pack?.integrity ?? "")
  )
    throw new Error("Invalid package artifact metadata");
  return { filename: pack.filename, integrity: pack.integrity };
}
