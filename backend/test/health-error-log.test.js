const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const serverSrc = fs.readFileSync(
  path.join(__dirname, "..", "server.js"),
  "utf8"
);

// E1: /api/health catch block must log the error so DB failures appear in server logs.

test("/api/health catch block names the error variable (not bare catch)", () => {
  // Bare `catch {` (no binding) means the error is inaccessible to console.error.
  // Verify the named form is used.
  assert.ok(
    /catch\s*\(\s*error\s*\)/.test(serverSrc),
    "server.js must use catch (error) — bare 'catch {}' makes the error inaccessible"
  );
});

test("/api/health catch block calls console.error so DB errors appear in logs", () => {
  // Look for console.error near the health-check section.
  const healthSection = serverSrc.match(
    /\/\* =+\s*HEALTH[\s\S]*?\/\* =+\s*AUTH/
  )?.[0];

  assert.ok(
    healthSection,
    "Could not locate the HEALTH section in server.js"
  );

  assert.ok(
    /console\.error/.test(healthSection),
    "/api/health catch block must call console.error to surface DB errors"
  );
});
