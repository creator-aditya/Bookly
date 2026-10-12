/**
 * Calculates the age in full years from a date-of-birth string (YYYY-MM-DD).
 * Returns -1 if the string cannot be parsed as a valid date.
 */
function calculateAge(dateOfBirth) {
  const dob = new Date(
    `${dateOfBirth}T00:00:00`
  );

  if (
    Number.isNaN(
      dob.getTime()
    )
  ) {
    return -1;
  }

  const today = new Date();

  let age =
    today.getFullYear() -
    dob.getFullYear();

  const month =
    today.getMonth() -
    dob.getMonth();

  if (
    month < 0 ||
    (
      month === 0 &&
      today.getDate() < dob.getDate()
    )
  ) {
    age--;
  }

  return age;
}

/**
 * Normalises a reading_progress row from the database.
 * PostgreSQL returns NUMERIC columns as strings; this converts them to numbers.
 * When no row exists, returns the default "not started" progress.
 *
 * @param {object|undefined} row - Raw row from pg query result.
 * @returns {{ page_number: number, scroll_percent: number }}
 */
function normalizeProgress(row) {
  if (!row) {
    return { page_number: 1, scroll_percent: 0 };
  }

  return {
    ...row,
    page_number: Number(row.page_number) || 1,
    scroll_percent: Number(row.scroll_percent) || 0
  };
}

module.exports = { calculateAge, normalizeProgress };
