const jwt = require("jsonwebtoken");
const pool = require("../db");

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not set.");
}

function authenticate(req, res, next) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || "");

  if (!match) {
    return res.status(401).json({
      error: "Unauthorized. Please log in.",
      code: "NO_TOKEN"
    });
  }

  try {
    req.user = jwt.verify(match[1], process.env.JWT_SECRET, {
      algorithms: ["HS256"]
    });
    next();
  } catch (err) {
    const expired = err.name === "TokenExpiredError";
    res.status(401).json({
      error: expired ? "Your session has expired. Please log in again." : "Invalid session.",
      code: expired ? "TOKEN_EXPIRED" : "INVALID_TOKEN"
    });
  }
}

// Role is read fresh from the database, not from the token
async function requireAdmin(req, res, next) {
  try {
    const result = await pool.query(
      "SELECT role FROM users WHERE id = $1",
      [req.user?.id]
    );

    if (result.rows[0]?.role !== "ADMIN") {
      return res.status(403).json({ error: "Admin access required." });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate, requireAdmin };