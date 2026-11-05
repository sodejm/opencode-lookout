import test from "node:test";
import assert from "node:assert/strict";
import { supportsPolicyAPI } from "../src/compatibility.mjs";

test("current policy API rejects older and unknown hosts instead of ineffective controls", () => {
  for (const version of [
    "2.2.1",
    "2.2.2",
    "2.2.3-rc.1",
    "1.9.9",
    "3.0.0",
    "dev",
    "",
    "unknown",
  ])
    assert.equal(supportsPolicyAPI(version), false, version);
  for (const version of ["2.2.3", "2.2.4", "2.2.5", "2.2.6-rc.1", "2.3.0-rc.1"])
    assert.equal(supportsPolicyAPI(version), true, version);
});
