/** Collect fresh hosted evidence; no remote writes or credential output. */
import { readFile } from "node:fs/promises";
import { validatePublishEvidence } from "./npm-policy.mjs";

const repository = "sodejm/opencode-lookout";
const { GH_TOKEN, APPROVED_SHA, GITHUB_SHA, GITHUB_REF, GITHUB_REPOSITORY } =
  process.env;
const manifest = JSON.parse(await readFile("package.json", "utf8"));
const tag = `v${manifest.version}`;
if (
  !GH_TOKEN ||
  GITHUB_REPOSITORY !== repository ||
  GITHUB_SHA !== APPROVED_SHA ||
  GITHUB_REF !== `refs/tags/${tag}` ||
  !/^[a-f0-9]{40}$/.test(APPROVED_SHA ?? "")
)
  throw new Error(
    "Dispatch the exact approved release tag in the canonical repository",
  );
/** @param {string} path Repository-relative API path, never an arbitrary host. */
async function api(path) {
  const response = await fetch(
    `https://api.github.com/repos/${repository}/${path}`,
    {
      headers: {
        Authorization: `Bearer ${GH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!response.ok)
    throw new Error(`GitHub evidence request failed: ${response.status}`);
  return response.json();
}
/** @param {string} sha Revision whose most recent full workflow attempts must pass. */
async function runs(sha) {
  return Promise.all(
    ["ci.yml", "codeql.yml"].map(async (workflow) => {
      const data =
        /** @type {{workflow_runs:import('./npm-policy.mjs').HostedRun[], total_count:number}} */ (
          await api(
            `actions/workflows/${workflow}/runs?head_sha=${sha}&per_page=100`,
          )
        );
      if (!Array.isArray(data.workflow_runs) || data.total_count > 100)
        throw new Error("Incomplete workflow listing");
      const eligible = data.workflow_runs.filter(
        (run) => workflow !== "codeql.yml" || run.event !== "pull_request",
      );
      // Never fall back to an older success after a failed or incomplete newer run.
      eligible.sort((a, b) => b.id - a.id);
      const run = eligible[0];
      if (!run || !Number.isSafeInteger(run.id))
        throw new Error("Missing workflow run");
      const jobs = await api(
        `actions/runs/${run.id}/jobs?filter=latest&per_page=100`,
      );
      if (!Array.isArray(jobs.jobs) || jobs.total_count !== jobs.jobs.length)
        throw new Error("Incomplete job listing");
      return { ...run, jobs: jobs.jobs };
    }),
  );
}
const ref = await api(`git/ref/tags/${encodeURIComponent(tag)}`);
if (ref.object?.type !== "tag" || !/^[a-f0-9]{40}$/.test(ref.object.sha))
  throw new Error("Expected annotated release tag");
const candidate = await api(`commits/${APPROVED_SHA}`);
const main = await api("commits/main");
const evidence = {
  candidate,
  main,
  release: await api(`releases/tags/${encodeURIComponent(tag)}`),
  tag: await api(`git/tags/${ref.object.sha}`),
  candidateRuns: await runs(candidate.sha),
  mainRuns: await runs(main.sha),
};
validatePublishEvidence(evidence, APPROVED_SHA ?? "", tag);
const version = await fetch(
  `https://registry.npmjs.org/opencode-lookout/${encodeURIComponent(manifest.version)}`,
  { signal: AbortSignal.timeout(30000) },
);
if (version.status !== 404)
  throw new Error(
    "Version already exists or registry availability is unproven",
  );
console.log(
  `PASS hosted release evidence for ${tag} at ${APPROVED_SHA}; publication remains a separate step`,
);
