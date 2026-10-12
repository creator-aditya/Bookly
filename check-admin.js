require("dotenv").config();
const bcrypt = require("bcryptjs");
const { Client } = require("pg");

(async () => {
  const email = "bugtester135@gmail.com";
  const tryPassword = "MyAdmin2026!";

  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const r = await c.query(
    "SELECT id, email, role, email_verified, password_hash FROM users WHERE lower(email) = lower($1)",
    [email]
  );

  if (r.rowCount === 0) {
    console.log("NO USER with email:", email);
    await c.end();
    return;
  }

  const u = r.rows[0];
  console.log("id:              ", u.id);
  console.log("email:           ", JSON.stringify(u.email));
  console.log("role:            ", u.role);
  console.log("email_verified:  ", u.email_verified);
  console.log("hash prefix:     ", u.password_hash.slice(0, 7));
  console.log("hash length:     ", u.password_hash.length);

  const match = await bcrypt.compare(tryPassword, u.password_hash);
  console.log("---");
  console.log(`Does "${tryPassword}" match the stored hash? ->`, match);

  if (!match) {
    const newHash = await bcrypt.hash(tryPassword, 12);
    const upd = await c.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [newHash, u.id]
    );
    console.log("Reset applied. rows updated:", upd.rowCount);
    console.log(`Password is now: ${tryPassword}`);
  }

  await c.end();
})();