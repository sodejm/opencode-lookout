import test from "node:test";
import assert from "node:assert/strict";
import { parseConfig, owned, change, ID } from "../src/config.mjs";

test("skill and MCP restrictions are exact denies and reversible, preserving comments", () => {
  const original =
    '{\n // keep me\n "model":"x/y", "policies": [ {"action":"skill.use","resource":"other","effect":"deny"} ],\n "plugins": []\n}';
  let next = change(original, "skill", "review", false);
  next = change(next, "mcp", "local-server", false);
  assert.equal(parseConfig(next).model, "x/y");
  assert.equal(parseConfig(next).policies.length, 3);
  assert.deepEqual(owned(next), [
    { kind: "mcp", id: "local-server" },
    { kind: "skill", id: "review" },
  ]);
  next = change(next, "skill", "review", true);
  next = change(next, "mcp", "local-server", true);
  assert.equal(next, original);
});
test("plugin disable survives restart and enabling removes only our entry", () => {
  const original = '{"plugins":["other", "-team.keep",], "policies": []}';
  const next = change(original, "plugin", "local.widget", false);
  assert.deepEqual(parseConfig(next).plugins, [
    "other",
    "-team.keep",
    "-local.widget",
  ]);
  assert.deepEqual(owned(next), [{ kind: "plugin", id: "local.widget" }]);
  assert.equal(change(next, "plugin", "local.widget", true), original);
});
test("empty config and missing arrays work; repeated changes are idempotent", () => {
  const next = change("{}", "skill", "test", false);
  assert.equal(change(next, "skill", "test", false), next);
  assert.equal(
    parseConfig(change(next, "skill", "test", true)).policies.length,
    0,
  );
});
test("reject malformed config, duplicate keys, invalid ids, unsupported kinds and protected plugins", () => {
  for (const text of [
    "{oops",
    '{"policies":[],"policies":[]}',
    '{"plugins":{}}',
  ])
    assert.throws(() => change(text, "skill", "test", false));
  for (const id of ["*", "test?", "foo\nbar", "x*/", "", "-other"])
    assert.throws(() => change("{}", "skill", id, false));
  for (const id of [ID, "opencode.config.policy", "opencode.provider.opencode"])
    assert.throws(() => change("{}", "plugin", id, false));
  assert.throws(() => change("{}", "agent", "build", false));
});
test("unmanaged denials cannot be enabled; removing ours never adds an allow", () => {
  const original =
    '{"policies":[{"action":"skill.use","resource":"*","effect":"deny"}]}';
  assert.throws(() => change(original, "skill", "test", true));
  const next = change(original, "skill", "test", false);
  assert.equal(change(next, "skill", "test", true), original);
});
test("reject modified ownership blocks instead of deleting user edits", () => {
  const next = change("{}", "skill", "test", false);
  assert.throws(() =>
    change(next.replace('"deny"', '"allow"'), "skill", "test", true),
  );
  assert.throws(() =>
    owned(next.replace("lookout:end:policies", "lookout:end:bad")),
  );
});
