const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

require("dotenv").config();

const required = [
  "DATABASE_URL",
  "JWT_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY"
];

const missing = required.filter(
  (key) => !process.env[key]
);

if (missing.length) {
  console.error(
    `Missing environment variables: ${missing.join(", ")}`
  );
  process.exit(1);
}

if (process.env.JWT_SECRET.length < 32) {
  console.error(
    "JWT_SECRET must be at least 32 characters."
  );
  process.exit(1);
}

const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");

const pool = require("./db");

const supabase = require("./supabase");
const {
  authenticate,
  requireAdmin
} = require("./middleware/auth");
const { extractMetadata } = require("./lib/extractMetadata");

const app = express();
app.set("trust proxy", 1);

const PORT = Number(process.env.PORT || 3000);
const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const AI_REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 15000);

/* =========================
   SECURITY HEADERS
========================= */

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "img-src": [
          "'self'",
          "data:",
          "blob:",
          "https:"
        ],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "font-src": ["'self'", "data:"],
        "connect-src": [
          "'self'",
          process.env.SUPABASE_URL
        ].filter(Boolean),
        "frame-src": [
          "'self'",
          process.env.SUPABASE_URL
        ].filter(Boolean),
        "worker-src": ["'self'", "blob:"],
        "frame-ancestors": ["'self'"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "upgrade-insecure-requests": []
      }
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
  })
);

/* =========================
   FILE UPLOAD
========================= */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/epub+zip"
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error(
        "Only PDF and EPUB files are allowed."
      );

      error.status = 400;
      error.expose = true;

      cb(error);
    }
  }
});

/* =========================
   MIDDLEWARE
========================= */

app.use(
  express.json({
    limit: "100kb"
  })
);

app.use(
  express.urlencoded({
    extended: false
  })
);

const frontendPath = path.join(
  __dirname,
  "..",
  "frontend"
);

app.use(
  express.static(frontendPath)
);

app.use(
  "/pdfjs",
  express.static(
    path.join(__dirname, "..", "node_modules", "pdfjs-dist", "build")
  )
);

/* =========================
   RATE LIMITING
========================= */

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
});

app.use(
  "/api/auth/login",
  authLimiter
);

app.use(
  "/api/auth/register",
  authLimiter
);

/* =========================
   ID VALIDATION
========================= */

function validateNumericId(
  _req,
  res,
  next,
  value
) {
  if (!/^\d{1,9}$/.test(value)) {
    return res.status(404).json({
      error: "Not found."
    });
  }

  next();
}

app.param(
  "id",
  validateNumericId
);

app.param(
  "bookId",
  validateNumericId
);

/* =========================
   HELPERS
========================= */

const { calculateAge, normalizeProgress } = require("./lib/helpers");

function isDisposableEmail(email) {
  const blockedDomains = new Set([
    "mailinator.com",
    "guerrillamail.com",
    "10minutemail.com",
    "temp-mail.org",
    "tempmail.com",
    "yopmail.com",
    "sharklasers.com",
    "getnada.com"
  ]);

  const domain =
    email
      .split("@")[1]
      ?.toLowerCase();

  return domain
    ? blockedDomains.has(domain)
    : true;
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email
    },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: "2h"
    }
  );
}

/* =========================
   AI RECOMMENDATIONS
========================= */

function normalizeEmbedding(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const embedding = value.map(Number);

  if (
    embedding.some((item) => !Number.isFinite(item)) ||
    embedding.length !== 384
  ) {
    return null;
  }

  return embedding;
}

async function requestEmbedding(book) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    AI_REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(`${AI_SERVICE_URL}/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: book.title,
        author: book.author,
        genre: book.genre,
        category: book.category,
        description: book.description
      }),
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.detail || data.error || `AI service returned ${response.status}.`);
    }

    const embedding = normalizeEmbedding(data.embedding);

    if (!embedding) {
      throw new Error("AI service returned an invalid 384-dimensional embedding.");
    }

    return embedding;
  } finally {
    clearTimeout(timeout);
  }
}

async function saveBookEmbedding(book) {
  const embedding = await requestEmbedding(book);

  await pool.query(
    `UPDATE books
     SET embedding = $1::jsonb,
         embedding_model = $2,
         embedding_updated_at = NOW()
     WHERE id = $3`,
    [JSON.stringify(embedding), "sentence-transformers/all-MiniLM-L6-v2", book.id]
  );

  return embedding;
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const x = Number(a[i]);
    const y = Number(b[i]);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return 0;
    }

    dot += x * y;
    normA += x * x;
    normB += y * y;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function averageEmbeddings(embeddings) {
  if (!embeddings.length) {
    return null;
  }

  const valid = embeddings.filter(
    (embedding) => Array.isArray(embedding) && embedding.length === 384
  );

  if (!valid.length) {
    return null;
  }

  const result = Array(384).fill(0);

  for (const embedding of valid) {
    for (let i = 0; i < 384; i++) {
      result[i] += Number(embedding[i]) || 0;
    }
  }

  for (let i = 0; i < 384; i++) {
    result[i] /= valid.length;
  }

  return result;
}

async function getBookForEmbedding(bookId) {
  const result = await pool.query(
    `SELECT id, title, author, description, category, genre
     FROM books
     WHERE id = $1`,
    [bookId]
  );

  return result.rows[0] || null;
}

/* =========================
   FILE TYPE DETECTION
========================= */

function detectFileType(buffer) {
  if (
    buffer
      .subarray(0, 5)
      .toString("latin1") === "%PDF-"
  ) {
    return "PDF";
  }

  const zipSignature =
    Buffer.from([
      0x50,
      0x4b,
      0x03,
      0x04
    ]);

  if (
    buffer.length >= 4 &&
    buffer
      .subarray(0, 4)
      .equals(zipSignature)
  ) {
    return "EPUB";
  }

  return null;
}

/* =========================
   HEALTH
========================= */

app.get(
  "/api/health",
  async (_req, res) => {
    try {
      await pool.query("SELECT 1");

      res.json({
        status: "ok",
        database: "connected"
      });
    } catch (error) {
      console.error("Health check DB error:", error);
      res.status(503).json({
        status: "error",
        database: "unavailable"
      });
    }
  }
);

/* =========================
   AUTH - REGISTER
========================= */

app.post(
  "/api/auth/register",
  async (req, res) => {
    try {
      const {
        email,
        password,
        dateOfBirth
      } = req.body;

      if (
        !email ||
        !password ||
        !dateOfBirth
      ) {
        return res.status(400).json({
          error:
            "Email, password and date of birth are required."
        });
      }

      const normalizedEmail =
        String(email)
          .trim()
          .toLowerCase();

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          normalizedEmail
        )
      ) {
        return res.status(400).json({
          error:
            "Please enter a valid email address."
        });
      }

      if (
        isDisposableEmail(
          normalizedEmail
        )
      ) {
        return res.status(400).json({
          error:
            "Please use a permanent email address. Temporary or disposable email addresses are not supported."
        });
      }

      if (
        String(password).length < 8
      ) {
        return res.status(400).json({
          error:
            "Password must contain at least 8 characters."
        });
      }

      const age =
        calculateAge(
          dateOfBirth
        );

      if (age === -1) {
        return res.status(400).json({
          error:
            "Please enter a valid date of birth."
        });
      }

      if (age < 18) {
        return res.status(403).json({
          error:
            "Under 18: this platform is restricted to users aged 18 and above."
        });
      }

      if (age > 120) {
        return res.status(400).json({
          error:
            "Please enter a valid date of birth."
        });
      }

      const existing =
        await pool.query(
          "SELECT id FROM users WHERE email = $1",
          [normalizedEmail]
        );

      if (existing.rowCount) {
        return res.status(409).json({
          error:
            "An account with this email already exists."
        });
      }

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );

      const result =
        await pool.query(
          `INSERT INTO users
           (
             email,
             password_hash,
             date_of_birth,
             email_verified
           )
           VALUES
           (
             $1,
             $2,
             $3,
             TRUE
           )
           RETURNING
             id,
             email,
             role,
             email_verified,
             created_at`,
          [
            normalizedEmail,
            passwordHash,
            dateOfBirth
          ]
        );

      const user =
        result.rows[0];

      res.status(201).json({
        message:
          "Account created successfully.",
        token:
          createToken(user),
        user
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Unable to create account."
      });
    }
  }
);

/* =========================
   AUTH - LOGIN
========================= */

app.post(
  "/api/auth/login",
  async (req, res) => {
    try {
      const {
        email,
        password
      } = req.body;

      if (
        !email ||
        !password
      ) {
        return res.status(400).json({
          error:
            "Email and password are required."
        });
      }

      const normalizedEmail =
        String(email)
          .trim()
          .toLowerCase();

      const result =
        await pool.query(
          `SELECT
             id,
             email,
             password_hash,
             date_of_birth,
             role,
             email_verified
           FROM users
           WHERE email = $1`,
          [normalizedEmail]
        );

      if (!result.rowCount) {
        return res.status(401).json({
          error:
            "Invalid email or password."
        });
      }

      const user =
        result.rows[0];

      const valid =
        await bcrypt.compare(
          password,
          user.password_hash
        );

      if (!valid) {
        return res.status(401).json({
          error:
            "Invalid email or password."
        });
      }

      if (!user.email_verified) {
        return res.status(403).json({
          error:
            "Please verify your email before continuing."
        });
      }

      delete user.password_hash;

      res.json({
        message:
          "Login successful.",
        token:
          createToken(user),
        user
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Unable to log in."
      });
    }
  }
);

/* =========================
   AUTH - CURRENT USER
========================= */

app.get(
  "/api/auth/me",
  authenticate,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `SELECT
             id,
             email,
             role,
             email_verified,
             created_at
           FROM users
           WHERE id = $1`,
          [req.user.id]
        );

      if (!result.rowCount) {
        return res.status(404).json({
          error:
            "User not found."
        });
      }

      res.json({
        user:
          result.rows[0]
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Unable to load user information."
      });
    }
  }
);

/* =========================
   BOOKS
========================= */

app.get(
  "/api/books",
  async (req, res) => {
    try {
      const {
        search,
        category
      } = req.query;

      const values = [];
      const conditions = [];

      if (search) {
        values.push(
          `%${String(search).trim()}%`
        );

        conditions.push(
          `(title ILIKE $${values.length}
            OR author ILIKE $${values.length})`
        );
      }

      if (category) {
        values.push(
          String(category)
        );

        conditions.push(
          `category = $${values.length}`
        );
      }

      const where =
        conditions.length
          ? `WHERE ${conditions.join(" AND ")}`
          : "";

      const result =
        await pool.query(
          `SELECT
             id,
             title,
             author,
             description,
             category,
             genre,
             language,
             publication_year,
             page_count,
             price,
             currency,
             is_free,
             cover_image
           FROM books
           ${where}
           ORDER BY created_at DESC`,
          values
        );

      res.json({
        books:
          result.rows
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Unable to load books."
      });
    }
  }
);

/* =========================
   BOOK DETAILS
========================= */

app.get(
  "/api/books/:id",
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `SELECT
             id,
             title,
             author,
             description,
             category,
             genre,
             language,
             publication_year,
             page_count,
             price,
             currency,
             is_free,
             cover_image
           FROM books
           WHERE id = $1`,
          [req.params.id]
        );

      if (!result.rowCount) {
        return res.status(404).json({
          error:
            "Book not found."
        });
      }

      res.json({
        book:
          result.rows[0]
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Unable to load book."
      });
    }
  }
);

/* =========================
   READ BOOK
========================= */

app.get(
  "/api/books/:id/read",
  authenticate,
  async (req, res) => {
    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    );

    try {
      const result =
        await pool.query(
          `SELECT
             id,
             title,
             author,
             description,
             file_key,
             file_type,
             is_free,
             price
           FROM books
           WHERE id = $1`,
          [req.params.id]
        );

      if (!result.rowCount) {
        return res.status(404).json({
          error:
            "Book not found."
        });
      }

      const book =
        result.rows[0];

      if (!book.file_key) {
        return res.status(404).json({
          error:
            "This book file is not available yet."
        });
      }

      if (!book.is_free) {
        return res.status(403).json({
          error:
            "This is a paid book. Purchase access will be added in the next phase."
        });
      }

      const {
        data,
        error
      } =
        await supabase.storage
          .from("books")
          .createSignedUrl(
            book.file_key,
            300
          );

      if (
        error ||
        !data?.signedUrl
      ) {
        console.error(error);

        return res.status(500).json({
          error:
            "Unable to create secure reading URL."
        });
      }

      res.json({
        book: {
          id: book.id,
          title: book.title,
          author: book.author,
          file_type:
            book.file_type
        },
        reading_url:
          data.signedUrl
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Unable to open book."
      });
    }
  }
);

/* =========================
   READING PROGRESS
========================= */

app.get(
  "/api/books/:id/progress",
  authenticate,
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT page_number, scroll_percent, updated_at
         FROM reading_progress
         WHERE user_id = $1 AND book_id = $2`,
        [req.user.id, req.params.id]
      );

      res.json({
        progress: normalizeProgress(result.rows[0])
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Unable to load progress." });
    }
  }
);

app.put(
  "/api/books/:id/progress",
  authenticate,
  async (req, res) => {
    try {
      const page = Number.parseInt(req.body.page_number, 10);
      const scroll = Number(req.body.scroll_percent);

      if (!Number.isFinite(page) || page < 1) {
        return res.status(400).json({ error: "Invalid page number." });
      }

      const safeScroll = Number.isFinite(scroll)
        ? Math.min(Math.max(scroll, 0), 100)
        : 0;

      await pool.query(
        `INSERT INTO reading_progress
           (user_id, book_id, page_number, scroll_percent, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id, book_id)
         DO UPDATE SET
           page_number = EXCLUDED.page_number,
           scroll_percent = EXCLUDED.scroll_percent,
           updated_at = NOW()`,
        [req.user.id, req.params.id, page, safeScroll]
      );

      res.json({ message: "Progress saved." });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Unable to save progress." });
    }
  }
);

/* =========================
   AI BOOK EMBEDDING
========================= */

app.post(
  "/api/admin/books/:id/embedding",
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      const book = await getBookForEmbedding(req.params.id);

      if (!book) {
        return res.status(404).json({
          error: "Book not found."
        });
      }

      await saveBookEmbedding(book);

      res.json({
        message: "Book embedding generated successfully.",
        bookId: book.id,
        model: "sentence-transformers/all-MiniLM-L6-v2",
        dimensions: 384
      });
    } catch (error) {
      console.error("Embedding generation failed:", error);

      res.status(502).json({
        error: "Unable to generate the book embedding. Make sure the AI service is running."
      });
    }
  }
);

app.post(
  "/api/admin/books/embeddings",
  authenticate,
  requireAdmin,
  async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, title, author, description, category, genre
         FROM books
         ORDER BY id ASC`
      );

      let generated = 0;
      let failed = 0;

      for (const book of result.rows) {
        try {
          await saveBookEmbedding(book);
          generated++;
        } catch (error) {
          failed++;
          console.error(`Embedding failed for book ${book.id}:`, error.message);
        }
      }

      res.json({
        message: "Book embedding backfill completed.",
        total: result.rows.length,
        generated,
        failed
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Unable to backfill book embeddings."
      });
    }
  }
);

/* =========================
   AI RECOMMENDATIONS
========================= */

app.get(
  "/api/recommendations",
  authenticate,
  async (req, res) => {
    try {
      const requestedLimit = Number.parseInt(req.query.limit, 10);
      const limit = Number.isFinite(requestedLimit)
        ? Math.min(Math.max(requestedLimit, 1), 24)
        : 12;
      const bookId = req.query.bookId ? Number(req.query.bookId) : null;

      let profileEmbedding = null;
      let source = "library";

      if (bookId) {
        const target = await pool.query(
          `SELECT id, embedding
           FROM books
           WHERE id = $1`,
          [bookId]
        );

        if (!target.rowCount) {
          return res.status(404).json({ error: "Book not found." });
        }

        profileEmbedding = normalizeEmbedding(target.rows[0].embedding);

        if (!profileEmbedding) {
          const book = await getBookForEmbedding(bookId);
          profileEmbedding = await saveBookEmbedding(book);
        }

        source = "book";
      } else {
        const history = await pool.query(
          `SELECT books.id, books.embedding
           FROM library
           INNER JOIN books ON books.id = library.book_id
           WHERE library.user_id = $1
           ORDER BY library.added_at DESC
           LIMIT 20`,
          [req.user.id]
        );

        const embeddings = history.rows
          .map((row) => normalizeEmbedding(row.embedding))
          .filter(Boolean);

        profileEmbedding = averageEmbeddings(embeddings);
      }

      const libraryResult = await pool.query(
        `SELECT book_id
         FROM library
         WHERE user_id = $1`,
        [req.user.id]
      );
      const libraryIds = new Set(libraryResult.rows.map((row) => Number(row.book_id)));

      const candidates = await pool.query(
        `SELECT
           id,
           title,
           author,
           description,
           category,
           genre,
           language,
           publication_year,
           page_count,
           price,
           currency,
           is_free,
           cover_image,
           embedding,
           created_at
         FROM books
         ORDER BY created_at DESC
         LIMIT 200`
      );

      if (!profileEmbedding) {
        source = "cold-start";

        return res.json({
          source,
          recommendations: candidates.rows
            .filter((book) => !libraryIds.has(Number(book.id)))
            .slice(0, limit)
            .map(({ embedding, created_at, ...book }) => book)
        });
      }

      const scored = [];

      for (const candidate of candidates.rows) {
        const id = Number(candidate.id);

        if (libraryIds.has(id) || (bookId && id === bookId)) {
          continue;
        }

        let embedding = normalizeEmbedding(candidate.embedding);

        if (!embedding) {
          try {
            embedding = await saveBookEmbedding(candidate);
          } catch (error) {
            console.error(`Skipping book ${id}:`, error.message);
            continue;
          }
        }

        const score = cosineSimilarity(profileEmbedding, embedding);
        const { embedding: _embedding, created_at: _createdAt, ...book } = candidate;

        scored.push({
          ...book,
          score: Number(score.toFixed(6))
        });
      }

      scored.sort((a, b) => b.score - a.score);

      res.json({
        source,
        model: "sentence-transformers/all-MiniLM-L6-v2",
        recommendations: scored.slice(0, limit)
      });
    } catch (error) {
      console.error("Recommendation generation failed:", error);

      res.status(500).json({
        error: "Unable to generate recommendations."
      });
    }
  }
);

/* =========================
   MY LIBRARY
========================= */

app.get(
  "/api/library",
  authenticate,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `SELECT
             books.id,
             books.title,
             books.author,
             books.description,
             books.category,
             books.genre,
             books.language,
             books.publication_year,
             books.page_count,
             books.price,
             books.currency,
             books.is_free,
             books.cover_image,
             library.added_at,
             reading_progress.page_number,
             reading_progress.scroll_percent
           FROM library
           INNER JOIN books
             ON library.book_id = books.id
           LEFT JOIN reading_progress
             ON reading_progress.book_id = books.id
            AND reading_progress.user_id = library.user_id
           WHERE library.user_id = $1
           ORDER BY library.added_at DESC`,
          [req.user.id]
        );

      res.json({
        books:
          result.rows
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Unable to load your library."
      });
    }
  }
);

/* =========================
   ADD TO LIBRARY
========================= */

app.post(
  "/api/library/:bookId",
  authenticate,
  async (req, res) => {
    try {
      const bookResult =
        await pool.query(
          "SELECT id FROM books WHERE id = $1",
          [req.params.bookId]
        );

      if (!bookResult.rowCount) {
        return res.status(404).json({
          error:
            "Book not found."
        });
      }

      const result =
        await pool.query(
          `INSERT INTO library
           (
             user_id,
             book_id
           )
           VALUES
           (
             $1,
             $2
           )
           ON CONFLICT
           (
             user_id,
             book_id
           )
           DO NOTHING
           RETURNING id`,
          [
            req.user.id,
            req.params.bookId
          ]
        );

      if (!result.rowCount) {
        return res.json({
          message:
            "Book is already in your library."
        });
      }

      res.status(201).json({
        message:
          "Book added to your library."
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Unable to add book to library."
      });
    }
  }
);

/* =========================
   REMOVE FROM LIBRARY
========================= */

app.delete(
  "/api/library/:bookId",
  authenticate,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `DELETE FROM library
           WHERE user_id = $1
           AND book_id = $2
           RETURNING id`,
          [
            req.user.id,
            req.params.bookId
          ]
        );

      if (!result.rowCount) {
        return res.status(404).json({
          error:
            "Book is not in your library."
        });
      }

      res.json({
        message:
          "Book removed from your library."
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Unable to remove book from library."
      });
    }
  }
);

/* =========================
   ADMIN
========================= */

app.get(
  "/api/admin/ping",
  authenticate,
  requireAdmin,
  (_req, res) => {
    res.json({
      message:
        "Admin authorization is working."
    });
  }
);

/* =========================
   ADMIN BOOK UPLOAD
========================= */

app.post(
  "/api/admin/books/upload",
  authenticate,
  requireAdmin,
  upload.single("book"),
  async (req, res) => {
    let fileKey = null;

    try {
      if (!req.file) {
        return res.status(400).json({
          error:
            "Please select a PDF or EPUB file."
        });
      }

      let {
        title,
        author,
        description,
        category,
        genre
      } = req.body;

      // Fallback: extract from file if any required field is missing.
      // Only triggers when the caller bypasses the frontend.
      const missing =
        !title || !author || !description || !category || !genre;

      if (missing) {
        try {
          const detectedType = detectFileType(req.file.buffer);

          if (detectedType) {
            const extracted = await extractMetadata(
              req.file.buffer,
              detectedType
            );

            title = title || extracted.title;
            author = author || extracted.author;
            description = description || extracted.description;
            category = category || extracted.category;
            genre = genre || extracted.genre || "General";
          }
        } catch (extractionError) {
          console.error("Fallback extraction failed:", extractionError);
        }
      }

      if (
        !title ||
        !author ||
        !description ||
        !category ||
        !genre
      ) {
        return res.status(400).json({
          error:
            "Title, author, description, category and genre are required. " +
            "We tried to extract them from the file but couldn't find all of them — please provide them manually."
        });
      }

      /* =========================
         PRICE VALIDATION
      ========================= */

      const price =
        Number(
          req.body.price ?? 0
        );

      if (
        !Number.isFinite(price) ||
        price < 0
      ) {
        return res.status(400).json({
          error:
            "Price must be 0 or more."
        });
      }

      const isFree =
        price === 0;

      /* =========================
         VERIFY FILE CONTENT
      ========================= */

      const fileType =
        detectFileType(
          req.file.buffer
        );

      if (!fileType) {
        return res.status(400).json({
          error:
            "File content is not a valid PDF or EPUB."
        });
      }

      /* =========================
         ORGANIZED STORAGE PATH
      ========================= */

      const now = new Date();
      const year = now.getUTCFullYear();
      const month = String(now.getUTCMonth() + 1).padStart(2, "0");

      fileKey =
        `${year}/${month}/${crypto.randomUUID()}.${fileType.toLowerCase()}`;

      /* =========================
         SUPABASE UPLOAD
      ========================= */

      const {
        error: uploadError
      } =
        await supabase.storage
          .from("books")
          .upload(
            fileKey,
            req.file.buffer,
            {
              contentType:
                fileType === "PDF"
                  ? "application/pdf"
                  : "application/epub+zip",
              upsert: false
            }
          );

      if (uploadError) {
        console.error(
          uploadError
        );

        return res.status(500).json({
          error:
            "Unable to upload book file."
        });
      }

      /* =========================
         DATABASE INSERT
      ========================= */

      let result;

      try {
        result =
          await pool.query(
            `INSERT INTO books
             (
               title,
               author,
               description,
               category,
               genre,
               file_key,
               file_type,
               price,
               is_free
             )
             VALUES
             (
               $1,
               $2,
               $3,
               $4,
               $5,
               $6,
               $7,
               $8,
               $9
             )
             RETURNING
               id,
               title,
               author,
               file_key,
               file_type,
               price,
               is_free`,
            [
              title.trim(),
              author.trim(),
              description.trim(),
              category.trim(),
              genre.trim(),
              fileKey,
              fileType,
              price,
              isFree
            ]
          );
      } catch (dbError) {
        console.error(
          dbError
        );

        if (
          dbError.code ===
          "23505"
        ) {
          try {
            await supabase.storage
              .from("books")
              .remove([
                fileKey
              ]);
          } catch (cleanupError) {
            console.error(
              "Unable to remove duplicate book file:",
              cleanupError
            );
          }

          return res.status(409).json({
            error:
              "A book with the same title and author already exists."
          });
        }

        try {
          await supabase.storage
            .from("books")
            .remove([
              fileKey
            ]);
        } catch (cleanupError) {
          console.error(
            "Unable to remove orphaned file:",
            cleanupError
          );
        }

        throw dbError;
      }

      let embeddingStatus = "pending";

      try {
        const bookForEmbedding = await getBookForEmbedding(result.rows[0].id);
        await saveBookEmbedding(bookForEmbedding);
        embeddingStatus = "ready";
      } catch (embeddingError) {
        console.error(
          `Unable to generate embedding for book ${result.rows[0].id}:`,
          embeddingError
        );
      }

      res.status(201).json({
        message:
          "Book uploaded successfully.",
        embeddingStatus,
        book:
          result.rows[0]
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Unable to upload book."
      });
    }
  }
);

/* =========================
   ADMIN BOOK METADATA EXTRACT
========================= */

app.post(
  "/api/admin/books/extract",
  authenticate,
  requireAdmin,
  upload.single("book"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "Please select a PDF or EPUB file."
        });
      }

      const fileType = detectFileType(req.file.buffer);

      if (!fileType) {
        return res.status(400).json({
          error: "File content is not a valid PDF or EPUB."
        });
      }

      const metadata = await extractMetadata(req.file.buffer, fileType);

      res.json({ metadata, fileType });
    } catch (error) {
      console.error("Metadata extraction failed:", error);

      res.status(500).json({
        error: "Unable to extract metadata from this file."
      });
    }
  }
);

/* =========================
   API 404
========================= */

app.use(
  "/api",
  (_req, res) => {
    res.status(404).json({
      error:
        "Not found."
    });
  }
);

/* =========================
   FRONTEND CATCH-ALL
========================= */

app.get(
  "/{*splat}",
  (_req, res) => {
    res.sendFile(
      path.join(
        frontendPath,
        "index.html"
      )
    );
  }
);

/* =========================
   GLOBAL ERROR HANDLER
========================= */

app.use(
  (err, _req, res, _next) => {
    if (
      err instanceof multer.MulterError
    ) {
      if (
        err.code ===
        "LIMIT_FILE_SIZE"
      ) {
        return res.status(413).json({
          error:
            "File is too large (max 50 MB)."
        });
      }

      return res.status(400).json({
        error:
          err.message
      });
    }

    if (
      Number.isInteger(err.status) &&
      err.status >= 400 &&
      err.status < 500
    ) {
      return res.status(
        err.status
      ).json({
        error:
          err.expose
            ? err.message
            : "Bad request."
      });
    }

    console.error(err);

    res.status(500).json({
      error:
        "Internal server error."
    });
  }
);

/* =========================
   START SERVER
========================= */

app.listen(
  PORT,
  () => {
    console.log(
      `Book Platform running at http://localhost:${PORT}`
    );
  }
);