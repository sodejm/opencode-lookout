import test from "node:test";
import assert from "node:assert/strict";
import { lifecycle, parseConfig, owned, change, ID } from "../src/config.mjs";
test("load, unload, and reload are idempotent and preserve restrictions and unrelated plugins", () => {
  const path = "/config/extensions/opencode-lookout";
  let cfg = '{"plugins":["keep"], "policies": [], "model":"keep/model"}';
  cfg = change(cfg, "skill", "review", false);
  cfg = change(cfg, "plugin", "other", false);
  const loaded = lifecycle(cfg, path, true);
  assert.equal(lifecycle(loaded, path, true), loaded);
  const unloaded = lifecycle(loaded, path, false);
  assert.equal(lifecycle(unloaded, path, false), unloaded);
  assert.deepEqual(owned(unloaded), owned(cfg));
  assert.deepEqual(parseConfig(unloaded).plugins, ["-" + ID, "keep", "-other"]);
  assert.equal(parseConfig(unloaded).model, "keep/model");
  assert.equal(lifecycle(unloaded, path, true), loaded);
});
test("offline lifecycle refuses edited markers", () => {
  const loaded = lifecycle("{}", "/package", true);
  assert.throws(() =>
    lifecycle(loaded.replace("/package", "/user-edit"), "/package", false),
  );
});
