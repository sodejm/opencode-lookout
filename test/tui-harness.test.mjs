import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const harness = readFileSync(new URL("./tui.exp", import.meta.url), "utf8");
const reopen = harness.match(
  /expect \{\s+-re \{([^}]+)\} \{\}\s+timeout \{exit 12\}/,
);
assert(reopen, "locate the actual post-cancellation catalog assertion");
// This checkpoint uses a literal Tcl regexp, also valid as a JS regexp. Reject
// regexp syntax here rather than silently test different engine semantics.
assert(!/[\\^$.*+?()[\]{}|]/.test(reopen[1]));
const catalog = new RegExp(reopen[1]);

test("catalog reopen accepts a changed-cell placeholder redraw", () => {
  // Synthetic excerpt of the observed redraw: unchanged 'a', spaces and 's'
  // remain on screen, so stripping ANSI still cannot recover the placeholder.
  // No retained terminal transcript or fixture credentials are copied here.
  const redraw =
    "\x1b[11;15H\x1b[1mLookout · Skills · all\x1b[0m" +
    "\x1b[13;15HSe\x1b[13;18Hrch\x1b[13;22HIDs, names, de" +
    "\x1b[13;37Hcriptions, models…" +
    "\x1b[15;15HFixture skill fixture-skill · available";
  assert(!redraw.includes("Search IDs, names, descriptions, models"));
  assert.match(redraw, catalog);
  assert.match(
    "Lookout · Skills · all\r\nSearch IDs, names, descriptions, models…",
    catalog,
  );
});

test("catalog reopen rejects unrelated or missing dialog output", () => {
  for (const output of [
    "",
    "Lookout\r\nSearch / manage…",
    "Disable resource?\r\nApply Globally",
    "Fixture skill\r\nPin to sidebar",
    "Lookout · Plugins · all",
    "Lookout · Skills · disabled",
  ]) {
    assert.doesNotMatch(output, catalog);
  }
});
