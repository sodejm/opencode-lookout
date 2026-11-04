/** Check repository-owned relative Markdown links without network access. */
import { readdir, readFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const required = [
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "SUPPORT.md",
  "CODE_OF_CONDUCT.md",
  "GOVERNANCE.md",
  "CHANGELOG.md",
  "LICENSE",
  "docs/ARCHITECTURE.md",
  "docs/THREAT_MODEL.md",
];
for (const file of required) await access(resolve(root, file));

async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", "test-artifacts"].includes(entry.name))
      continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await check(path);
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const content = await readFile(path, "utf8");
    for (const match of content.matchAll(/\]\(([^)\s]+)\)/g)) {
      const link = match[1];
      if (/^(?:[a-z]+:|#)/i.test(link)) continue;
      const target = decodeURIComponent(link.split("#")[0]);
      await access(resolve(dirname(path), target));
    }
  }
}
await check(root);
console.log(
  "Documentation files and relative link targets exist (anchors and external URLs not checked).",
);
