const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateAge } = require("../lib/helpers");

// A2: calculateAge must return -1 for invalid input — not a negative age.

test("calculateAge returns -1 for a non-date string", () => {
  assert.strictEqual(calculateAge("abc"), -1);
});

test("calculateAge returns -1 for an empty string", () => {
  assert.strictEqual(calculateAge(""), -1);
});

test("calculateAge returns -1 for a partial date", () => {
  assert.strictEqual(calculateAge("2000-13-01"), -1); // month 13 is invalid
});

test("calculateAge returns the correct age for a known birth year", () => {
  const year = new Date().getFullYear() - 25;
  const age = calculateAge(`${year}-01-01`);
  // Allow ±1 because the birthday may not have passed yet this year
  assert.ok(
    age === 24 || age === 25,
    `Expected age 24 or 25 for birth year ${year}, got ${age}`
  );
});

test("calculateAge returns an age below 18 for someone born 10 years ago", () => {
  const year = new Date().getFullYear() - 10;
  const age = calculateAge(`${year}-01-01`);
  assert.ok(age < 18, `Expected age < 18, got ${age}`);
  // Crucially this must NOT be -1, so the register route correctly shows
  // "Under 18" and not "invalid date of birth"
  assert.notStrictEqual(age, -1);
});

test("calculateAge is NOT -1 for a valid future date (gives negative age, distinct from sentinel)", () => {
  const age = calculateAge("2999-01-01");
  assert.notStrictEqual(age, -1, "Future date must not return the -1 sentinel");
  assert.ok(age < 0, "Future date should give a negative (but non-sentinel) age");
});
