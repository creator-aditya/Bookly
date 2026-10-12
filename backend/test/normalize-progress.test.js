const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeProgress } = require("../lib/helpers");

// E2: pg returns NUMERIC as strings. normalizeProgress must cast them to numbers.

test("normalizeProgress returns default when row is undefined", () => {
  const result = normalizeProgress(undefined);
  assert.strictEqual(result.page_number, 1);
  assert.strictEqual(result.scroll_percent, 0);
  assert.strictEqual(typeof result.page_number, "number");
  assert.strictEqual(typeof result.scroll_percent, "number");
});

test("normalizeProgress returns default when row is null", () => {
  const result = normalizeProgress(null);
  assert.strictEqual(result.page_number, 1);
  assert.strictEqual(result.scroll_percent, 0);
});

test("normalizeProgress casts scroll_percent string from pg to a number", () => {
  // pg returns NUMERIC columns as strings — simulate what the real DB row looks like
  const pgRow = { page_number: 5, scroll_percent: "42.50", updated_at: new Date() };
  const result = normalizeProgress(pgRow);
  assert.strictEqual(typeof result.scroll_percent, "number");
  assert.strictEqual(result.scroll_percent, 42.5);
});

test("normalizeProgress casts page_number string from pg to a number", () => {
  const pgRow = { page_number: "7", scroll_percent: "0.00", updated_at: new Date() };
  const result = normalizeProgress(pgRow);
  assert.strictEqual(typeof result.page_number, "number");
  assert.strictEqual(result.page_number, 7);
});

test("normalizeProgress preserves other row fields (e.g. updated_at)", () => {
  const now = new Date();
  const pgRow = { page_number: 3, scroll_percent: "10.00", updated_at: now };
  const result = normalizeProgress(pgRow);
  assert.strictEqual(result.updated_at, now);
});

test("normalizeProgress falls back to page 1 when page_number is 0 or falsy", () => {
  const pgRow = { page_number: 0, scroll_percent: "0.00" };
  const result = normalizeProgress(pgRow);
  // Number(0) || 1  → 1 (0 is falsy)
  assert.strictEqual(result.page_number, 1);
});
