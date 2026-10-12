const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const schemaPath = path.join(
  __dirname,
  "..",
  "..",
  "database",
  "schema.sql"
);
const schema = fs.readFileSync(schemaPath, "utf8");

test("schema declares reading_progress table required by /api/library and /api/books/:id/progress", () => {
  const match = schema.match(
    /CREATE TABLE IF NOT EXISTS\s+reading_progress\s*\(([\s\S]*?)\n\);/i
  );

  assert.ok(
    match,
    "schema.sql must declare 'CREATE TABLE IF NOT EXISTS reading_progress (...)'"
  );

  const body = match[1];

  for (const column of [
    "user_id",
    "book_id",
    "page_number",
    "scroll_percent",
    "updated_at",
  ]) {
    assert.ok(
      new RegExp(`\\b${column}\\b`, "i").test(body),
      `reading_progress is missing column: ${column}`
    );
  }

  assert.ok(
    /UNIQUE\s*\(\s*user_id\s*,\s*book_id\s*\)/i.test(body),
    "reading_progress must have UNIQUE (user_id, book_id) so the PUT route's ON CONFLICT works"
  );

  assert.ok(
    /REFERENCES\s+users\s*\(\s*id\s*\)/i.test(body),
    "reading_progress.user_id must reference users(id)"
  );

  assert.ok(
    /REFERENCES\s+books\s*\(\s*id\s*\)/i.test(body),
    "reading_progress.book_id must reference books(id)"
  );
});