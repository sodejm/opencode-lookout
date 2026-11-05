/** CodeQL is hosted-only; validate all SARIF files after a successful analyze step. */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { scanClean } from "./release-policy.mjs";

const directory = process.argv[2];
if (!directory) throw new Error("Usage: check-codeql.mjs SARIF_DIRECTORY");
const files = (await readdir(directory)).filter((file) =>
  file.endsWith(".sarif"),
);
if (!files.length) throw new Error("Missing CodeQL SARIF evidence");
for (const file of files)
  scanClean(
    "codeql",
    JSON.parse(await readFile(join(directory, file), "utf8")),
    0,
  );
console.log(
  `PASS CodeQL: ${files.length} reports, no findings or analysis errors`,
);
