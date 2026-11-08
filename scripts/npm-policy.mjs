/** Fail-closed hosted evidence policy for a manually approved npm release. */
const repository = "sodejm/opencode-lookout";

/**
 * Derive network identifiers from the dispatch context; file data only verifies
 * the local package version and is never returned for use in a request URL.
 * @param {{repository?:string, ref?:string, sha?:string, approvedSHA?:string}} context GitHub dispatch identity.
 * @param {unknown} manifestVersion Local package version to compare, not transmit.
 * @returns {{tag:string, version:string, sha:string}} Validated public dispatch identifiers.
 */
export function publicationTarget(context, manifestVersion) {
  const match =
    /^refs\/tags\/v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/.exec(
      context.ref ?? "",
    );
  if (
    context.repository !== repository ||
    !match ||
    match[0] !== context.ref ||
    context.sha?.length !== 40 ||
    !/^[a-f0-9]{40}$/.test(context.sha) ||
    context.sha !== context.approvedSHA ||
    manifestVersion !== match[1]
  )
    throw new Error(
      "Dispatch the exact approved release tag matching the local package version",
    );
  return { tag: `v${match[1]}`, version: match[1], sha: context.sha };
}
const ciJobs = [
  "Runtime (Node 22)",
  "Runtime (Node 24)",
  "Quality (Node 26)",
  "Security",
  "Compatibility",
  "Release gate",
];
const codeqlJobs = ["Analyze (actions)", "Analyze (javascript-typescript)"];

/** @typedef {{name:string, status:string, conclusion:string, completed_at:string}} HostedJob */
/** @typedef {{id:number, path:string, head_sha:string, head_repository:{full_name:string}, event:string, status:string, conclusion:string, jobs:HostedJob[]}} HostedRun */
/** @typedef {{sha:string, commit:{tree:{sha:string}}}} HostedCommit */
/** @typedef {{release:{tag_name:string, draft:boolean, prerelease:boolean, published_at:string}, tag:{tag:string, object:{type:string, sha:string}, verification:{verified:boolean}}, candidate:HostedCommit, main:HostedCommit, candidateRuns:HostedRun[], mainRuns:HostedRun[]}} PublishEvidence */

/**
 * Require an immutable released tag, matching main tree, and fresh complete runs.
 * @param {PublishEvidence} evidence JSON collected from authenticated GitHub endpoints.
 * @param {string} sha Exact revision explicitly approved by the maintainer.
 * @param {string} tag Exact stable version tag used to dispatch the workflow.
 * @param {number} now Evaluation time for the 24-hour evidence window.
 */
export function validatePublishEvidence(evidence, sha, tag, now = Date.now()) {
  if (!/^[a-f0-9]{40}$/.test(sha) || !/^v\d+\.\d+\.\d+$/.test(tag))
    throw new Error("Expected an exact approved SHA and stable version tag");
  // Runtime JSON is deliberately validated here rather than trusted by type assertion.
  const value = evidence;
  if (
    value.release?.tag_name !== tag ||
    value.release?.draft !== false ||
    value.release?.prerelease !== false ||
    !value.release?.published_at
  )
    throw new Error("A published stable GitHub release is required");
  if (
    value.tag?.tag !== tag ||
    value.tag?.object?.type !== "commit" ||
    value.tag?.object?.sha !== sha ||
    value.tag?.verification?.verified !== true
  )
    throw new Error(
      "The verified annotated tag must target the approved revision",
    );
  if (
    value.candidate?.sha !== sha ||
    !/^[a-f0-9]{40}$/.test(value.main?.sha ?? "") ||
    !/^[a-f0-9]{40}$/.test(value.candidate?.commit?.tree?.sha ?? "") ||
    value.main?.commit?.tree?.sha !== value.candidate.commit.tree.sha
  )
    throw new Error("Main must have the approved source tree");
  const revisions = /** @type {Array<[string, HostedRun[]]>} */ ([
    [sha, value.candidateRuns],
    [value.main.sha, value.mainRuns],
  ]);
  for (const [revision, runs] of revisions) {
    if (!Array.isArray(runs) || runs.length !== 2)
      throw new Error("Missing workflow evidence");
    const workflows = /** @type {Array<[string, string[]]>} */ ([
      [".github/workflows/ci.yml", ciJobs],
      [".github/workflows/codeql.yml", codeqlJobs],
    ]);
    for (const [path, required] of workflows) {
      const matches = runs.filter((run) => run.path === path);
      if (matches.length !== 1)
        throw new Error("Missing or duplicate workflow evidence");
      const run = matches[0];
      const events =
        path.endsWith("codeql.yml") || revision === value.main.sha
          ? ["push", "workflow_dispatch", "schedule"]
          : ["push", "pull_request", "workflow_dispatch"];
      if (
        run.head_sha !== revision ||
        run.head_repository?.full_name !== repository ||
        !events.includes(run.event) ||
        run.status !== "completed" ||
        run.conclusion !== "success"
      )
        throw new Error(
          "Wrong source, incomplete or failed workflow; PR CodeQL is insufficient",
        );
      if (!Array.isArray(run.jobs)) throw new Error("Missing jobs");
      for (const name of required) {
        const jobs = run.jobs.filter((job) => job.name === name);
        if (
          jobs.length !== 1 ||
          jobs[0].status !== "completed" ||
          jobs[0].conclusion !== "success"
        )
          throw new Error(`Missing or failed required job: ${name}`);
        const age = now - Date.parse(jobs[0].completed_at);
        if (!Number.isFinite(age) || age < 0 || age > 86400000)
          throw new Error("Stale or invalid hosted evidence");
      }
    }
  }
}
