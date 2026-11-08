/** Audit an installed consumer graph without relying on the dependency's overrides. */
import { spawnSync } from "node:child_process";
import { scanClean } from "./release-policy.mjs";

const result = spawnSync(
  "npm",
  ["audit", "--prefix", process.argv[2], "--omit=dev", "--json"],
  { encoding: "utf8", timeout: 120000 },
);
scanClean("audit", JSON.parse(result.stdout), result.status);
console.log("PASS consumer dependency audit: no findings at any severity");
