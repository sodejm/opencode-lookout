import test from "node:test";
import assert from "node:assert/strict";
import {
  publicationTarget,
  validatePublishEvidence,
} from "../scripts/npm-policy.mjs";

test("publication requests use a validated dispatch tag, never local manifest data", () => {
  const context = {
    repository: "sodejm/opencode-lookout",
    ref: "refs/tags/v0.1.2",
    sha: "a".repeat(40),
    approvedSHA: "a".repeat(40),
  };
  assert.deepEqual(publicationTarget(context, "0.1.2"), {
    tag: "v0.1.2",
    version: "0.1.2",
    sha: context.sha,
  });
  for (const version of [undefined, null, {}, "0.1.1", "private/file/data"])
    assert.throws(() => publicationTarget(context, version));
  for (const ref of [
    undefined,
    "refs/heads/main",
    "refs/tags/v0.1.2-rc.1",
    "refs/tags/v01.1.2",
    "refs/tags/v0.1.2/extra",
    "refs/tags/v0.1.2?query",
    "refs/tags/v0.1.2\n",
  ])
    assert.throws(() => publicationTarget({ ...context, ref }, "0.1.2"));
  assert.throws(() =>
    publicationTarget({ ...context, repository: "other/repo" }, "0.1.2"),
  );
  assert.throws(() =>
    publicationTarget({ ...context, approvedSHA: "b".repeat(40) }, "0.1.2"),
  );
});

const now = Date.now();
const sha = "a".repeat(40),
  main = "b".repeat(40),
  tree = "c".repeat(40);
const jobs = [
  "Runtime (Node 22)",
  "Runtime (Node 24)",
  "Quality (Node 26)",
  "Security",
  "Compatibility",
  "Release gate",
];
const runs = (revision) =>
  [
    ["ci.yml", jobs, revision === sha ? "pull_request" : "push"],
    [
      "codeql.yml",
      ["Analyze (actions)", "Analyze (javascript-typescript)"],
      "push",
    ],
  ].map(([file, names, event]) => ({
    path: `.github/workflows/${file}`,
    head_sha: revision,
    head_repository: { full_name: "sodejm/opencode-lookout" },
    event,
    status: "completed",
    conclusion: "success",
    jobs: names.map((name) => ({
      name,
      status: "completed",
      conclusion: "success",
      completed_at: new Date(now).toISOString(),
    })),
  }));
const good = () => ({
  release: {
    tag_name: "v0.1.2",
    draft: false,
    prerelease: false,
    published_at: new Date(now).toISOString(),
  },
  tag: {
    tag: "v0.1.2",
    object: { type: "commit", sha },
    verification: { verified: true },
  },
  candidate: { sha, commit: { tree: { sha: tree } } },
  main: { sha: main, commit: { tree: { sha: tree } } },
  candidateRuns: runs(sha),
  mainRuns: runs(main),
});
test("npm publication requires released approved source and fresh full candidate/main checks", () => {
  assert.doesNotThrow(() =>
    validatePublishEvidence(good(), sha, "v0.1.2", now),
  );
  const reject = (mutate) => {
    const value = good();
    mutate(value);
    assert.throws(() => validatePublishEvidence(value, sha, "v0.1.2", now));
  };
  reject((v) => (v.release.draft = true));
  reject((v) => (v.release.prerelease = true));
  reject((v) => (v.release.tag_name = "v0.1.1"));
  reject((v) => (v.tag.object.sha = main));
  reject((v) => (v.tag.verification.verified = false));
  reject((v) => (v.main.commit.tree.sha = main));
  reject((v) => v.candidateRuns.pop());
  for (const side of ["candidateRuns", "mainRuns"]) {
    reject((v) => (v[side][1].event = "pull_request"));
    reject((v) => (v[side][0].head_sha = tree));
    reject((v) => (v[side][0].head_repository.full_name = "other/repo"));
    reject((v) => (v[side][0].status = "in_progress"));
    reject((v) => (v[side][0].conclusion = "failure"));
    reject((v) => v[side][0].jobs.pop());
    reject((v) => v[side][0].jobs.push(v[side][0].jobs[0]));
    reject((v) => (v[side][0].jobs[0].conclusion = "skipped"));
    for (const timestamp of ["invalid", now - 86400001, now + 1])
      reject(
        (v) =>
          (v[side][0].jobs[0].completed_at =
            typeof timestamp === "number"
              ? new Date(timestamp).toISOString()
              : timestamp),
      );
  }
  assert.throws(() => validatePublishEvidence(good(), "main", "v0.1.2", now));
  assert.throws(() => validatePublishEvidence(good(), sha, "v0.1.2-rc.1", now));
});
