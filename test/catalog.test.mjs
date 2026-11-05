import test from "node:test";
import assert from "node:assert/strict";
import { normalize, mergeOwned, filterRows, text } from "../src/catalog.mjs";
import { BROWSE_KINDS, displayRows, statusTone } from "../src/catalog.mjs";
const scope = {
  configDir: "/config/opencode",
  home: "/home/test",
  config: { mcp: { local: { type: "local" } } },
};
test("Lookout omits MCP from every display view without changing recovery rows", () => {
  const rows = mergeOwned(
    normalize("skill", [{ id: "fixture", name: "Fixture" }], scope),
    [{ kind: "mcp", id: "legacy" }],
  );
  assert.deepEqual(BROWSE_KINDS, [
    "agent",
    "skill",
    "plugin",
    "command",
    "provider",
    "model",
  ]);
  assert.deepEqual(
    displayRows(rows).map((r) => r.kind),
    ["skill"],
  );
  assert.equal(filterRows(displayRows(rows), { query: "legacy" }).length, 0);
  assert.equal(rows.find((r) => r.kind === "mcp").owned, true);
});
test("status dots distinguish availability, attention, failure and disabled states", () => {
  for (const status of ["active", "available", "connected"])
    assert.equal(statusTone({ status }), "success");
  for (const status of [
    "unknown",
    "stale",
    "pending",
    "needs_auth",
    "restricted; still listed",
  ])
    assert.equal(statusTone({ status }), "warning");
  for (const status of ["disabled", "disabled (Lookout)", "hidden", "inactive"])
    assert.equal(statusTone({ status }), "muted");
  assert.equal(statusTone({ status: "failed" }), "error");
  assert.equal(statusTone({ status: "future-status" }), "muted");
  assert.equal(
    statusTone({ status: "active" }, true),
    "warning",
    "stale snapshots must not look healthy",
  );
});
test("catalog only returns safe display fields and honest management capabilities", () => {
  const rows = normalize(
    "agent",
    [
      {
        id: "build",
        system: "SECRET",
        model: { providerID: "test", id: "code" },
        permissions: [{}],
      },
    ],
    scope,
  );
  assert.equal(rows[0].manageable, false);
  assert(!JSON.stringify(rows).includes("SECRET"));
  assert.equal(
    normalize(
      "plugin",
      [
        {
          id: "opencode.config.policy",
          source: { type: "builtin" },
          features: { server: true },
          state: { status: "active" },
        },
      ],
      scope,
    )[0].manageable,
    false,
  );
  assert.equal(
    normalize(
      "plugin",
      [
        {
          id: "mine",
          source: { type: "local", path: "/config/opencode/plugins/mine.js" },
          features: { server: true },
        },
      ],
      scope,
    )[0].manageable,
    true,
  );
  assert.equal(
    normalize(
      "skill",
      [
        {
          id: "foo",
          name: "Foo",
          path: "/cache/console/foo",
          content: "SECRET",
        },
      ],
      scope,
    )[0].manageable,
    false,
  );
  assert.equal(
    normalize(
      "mcp",
      [
        {
          name: "local",
          integrationID: "console",
          status: { status: "connected" },
        },
      ],
      scope,
    )[0].manageable,
    false,
  );
});
test("own disabled rows remain recoverable and do not falsely claim effective disable", () => {
  const rows = mergeOwned(
    [
      {
        kind: "skill",
        id: "foo",
        label: "Foo",
        status: "available",
        details: [],
      },
    ],
    [
      { kind: "skill", id: "foo" },
      { kind: "mcp", id: "gone" },
    ],
  );
  assert.equal(rows[0].status, "restricted; still listed");
  assert.equal(rows[1].status, "disabled (Lookout)");
  assert(rows.every((r) => r.owned && r.manageable));
});
test("search, state and category filters compose; duplicate labels and regex punctuation are safe", () => {
  const rows = normalize(
    "agent",
    [
      { id: "b", name: "Same" },
      { id: "a", name: "Same" },
    ],
    scope,
  );
  assert.deepEqual(
    filterRows(rows, { query: "same", kind: "agent" }).map((r) => r.id),
    ["a", "b"],
  );
  assert.equal(filterRows(rows, { query: "[.*" }).length, 0);
  assert.equal(filterRows(rows, { state: "managed" }).length, 0);
  assert.equal(filterRows(rows, { kind: "skill" }).length, 0);
  assert.equal(text("\x1b[31mRED\x00"), "RED ");
});
