const { Pool } = require("pg");

require("dotenv").config();

const isRemote = !/localhost|127\.0\.0\.1/.test(
  process.env.DATABASE_URL || ""
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemote ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000
});

pool.on("error", (err) => {
  console.error("Unexpected idle DB client error:", err);
});

module.exports = pool;