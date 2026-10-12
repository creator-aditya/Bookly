const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(
  path.join(__dirname, "..", "..", "frontend", "css", "main.css"),
  "utf8"
);

// C1: .book-three was declared twice. The duplicate stripped z-index:3 from the
// first rule, breaking the book stack's stacking order on the landing page.

test(".book-three selector appears exactly once as a standalone rule block", () => {
  // Match only lines where .book-three { is the sole selector (not compound like
  // ".hero-art:hover .book-three {"). Use a line-start anchor via split + filter.
  const standaloneRules = css
    .split("\n")
    .filter((line) => /^\s*\.book-three\s*\{/.test(line));

  assert.strictEqual(
    standaloneRules.length,
    1,
    `Expected exactly 1 standalone .book-three { rule, found ${standaloneRules.length}:\n${standaloneRules.join("\n")}`
  );
});

test(".book-three rule includes z-index", () => {
  // The canonical rule (lines 82-89) includes z-index: 3.
  // The duplicate that was removed did NOT — so if z-index is present
  // it confirms the right rule survived.
  const ruleBlock = css.match(/\.book-three\s*\{[^}]*\}/)?.[0] || "";
  assert.ok(
    /z-index/.test(ruleBlock),
    ".book-three rule must include z-index (the duplicate without it has been removed)"
  );
});
