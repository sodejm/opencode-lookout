/** Build and run real CLI server/TUI tests in disposable, network-isolated containers. */
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { output, discover, sourceDigest } from "./release-io.mjs";
import { packageArtifact } from "./package-artifact.mjs";

const directory = "release-evidence";
await mkdir(directory, { recursive: true });
await writeFile(`${directory}/compatibility.json`, "");
const source = sourceDigest();
// Pack once on the invoking host. Equal tar contents can have different gzip
// bytes across Node/zlib platforms, so every image must install these exact bytes.
await mkdir(".build/npm-artifact", { recursive: true });
const artifact = packageArtifact(".build/npm-artifact");
const targets = await discover();
const architecture = output("docker", [
  "info",
  "--format",
  "{{.Architecture}}",
]);
const architectures = /** @type {Record<string,string>} */ ({
  aarch64: "arm64",
  arm64: "arm64",
  x86_64: "x64",
  amd64: "x64",
});
const arch = architectures[architecture];
if (!arch) throw new Error(`Unsupported Docker architecture: ${architecture}`);
const cliPackage = `@opencode/cli-linux-${arch}`;
/** @type {Array<{version:string, mode:string, profile:string, exit:number|null, image:string, integrity:string}>} */
const results = [];
for (const version of targets) {
  const response = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(cliPackage)}/${encodeURIComponent(version)}`,
    { signal: AbortSignal.timeout(30000) },
  );
  if (!response.ok) throw new Error(`Missing CLI artifact: ${version}`);
  const metadata = await response.json();
  const integrity = metadata.dist?.integrity;
  if (!/^sha512-[A-Za-z0-9+/]{86}==$/.test(integrity ?? ""))
    throw new Error("Missing CLI integrity");
  const tag = `lookout-test:${version}-${source.slice(0, 12)}`;
  const build = spawnSync(
    "docker",
    [
      "build",
      "--file",
      "test/Dockerfile",
      "--tag",
      tag,
      "--build-arg",
      `CLI_VERSION=${version}`,
      "--build-arg",
      `CLI_PACKAGE=${cliPackage}`,
      "--build-arg",
      `CLI_INTEGRITY=${integrity}`,
      "--build-arg",
      `LOOKOUT_TARBALL=${artifact.filename}`,
      ".",
    ],
    { stdio: "inherit", timeout: 900000 },
  );
  if (build.status !== 0) throw new Error(`Docker build failed for ${version}`);
  const image = output("docker", [
    "image",
    "inspect",
    tag,
    "--format",
    "{{.Id}}",
  ]);
  const installedIntegrity = output("docker", [
    "run",
    "--rm",
    "--network",
    "none",
    "--read-only",
    "--cap-drop",
    "ALL",
    "--entrypoint",
    "node",
    image,
    "--input-type=module",
    "-e",
    'import {readFileSync} from "node:fs"; import {createHash} from "node:crypto"; console.log("sha512-"+createHash("sha512").update(readFileSync(process.argv[1])).digest("base64"));',
    `/artifacts/${artifact.filename}`,
  ]);
  if (installedIntegrity !== artifact.integrity)
    throw new Error("Docker installed a different npm artifact");
  for (const mode of ["wide", "narrow"]) {
    const name = `lookout-${randomUUID()}`;
    /** @type {number|null} */
    let exit;
    try {
      const result = spawnSync(
        "docker",
        [
          "run",
          "--rm",
          "--name",
          name,
          "--network",
          "none",
          "--read-only",
          "--cap-drop",
          "ALL",
          "--security-opt",
          "no-new-privileges",
          "--pids-limit",
          "256",
          "--memory",
          "3g",
          "--tmpfs",
          "/tmp:rw,exec,nosuid,size=1g",
          "--env",
          "LOOKOUT_TUI=1",
          "--env",
          `LOOKOUT_EXPECTED_VERSION=${version}`,
          "--env",
          `LOOKOUT_NARROW=${mode === "narrow" ? "1" : "0"}`,
          "--env",
          `LOOKOUT_THEME=${mode === "narrow" ? "tokyonight" : "carbonfox"}`,
          image,
        ],
        { stdio: "inherit", timeout: 240000 },
      );
      exit = result.status;
    } finally {
      // On timeout or interruption of docker run, remove only our uniquely named fixture.
      spawnSync("docker", ["rm", "--force", name], {
        stdio: "ignore",
        timeout: 30000,
      });
    }
    const profile = ["2.2.1", "2.2.2"].includes(version)
      ? "read-only"
      : "controls";
    results.push({ version, mode, profile, exit, image, integrity });
    await writeFile(
      `${directory}/compatibility.json`,
      JSON.stringify(
        {
          source,
          artifact,
          targets,
          architecture,
          created: new Date().toISOString(),
          results,
        },
        null,
        2,
      ),
    );
    if (exit !== 0)
      console.error(
        `Compatibility failed: ${version} ${mode}; continuing to collect the matrix`,
      );
  }
}
if (sourceDigest() !== source)
  throw new Error("Source changed during compatibility run");
if (results.some((result) => result.exit !== 0))
  throw new Error(
    "Compatibility matrix failed; see release-evidence/compatibility.json",
  );
console.log(
  `PASS compatibility: ${targets.join(", ")} (${architecture}), both terminal modes`,
);
