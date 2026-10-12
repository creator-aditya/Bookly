CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(320) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'READER'
        CHECK (role IN ('READER', 'ADMIN')),
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email
ON users(email);


CREATE TABLE IF NOT EXISTS books (
    id BIGSERIAL PRIMARY KEY,

    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,

    category VARCHAR(100) NOT NULL,
    genre VARCHAR(100) NOT NULL,
    language VARCHAR(50) NOT NULL DEFAULT 'English',

    publication_year INT,
    page_count INT,

    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    is_free BOOLEAN NOT NULL DEFAULT TRUE,

    cover_image TEXT,

    file_key TEXT,
    file_type VARCHAR(20),

    -- 384-dimensional sentence-transformer embedding.
    -- Stored as JSONB so Bookly works even when pgvector is unavailable.
    embedding JSONB,
    embedding_model VARCHAR(150),
    embedding_updated_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT books_price_check
        CHECK (price >= 0),

    CONSTRAINT books_free_price_check
        CHECK (
            (is_free AND price = 0)
            OR
            (NOT is_free AND price > 0)
        ),

    CONSTRAINT books_file_type_check
        CHECK (
            file_type IS NULL
            OR file_type IN ('PDF', 'EPUB')
        )
);


CREATE INDEX IF NOT EXISTS idx_books_title
ON books(title);

CREATE INDEX IF NOT EXISTS idx_books_author
ON books(author);

CREATE INDEX IF NOT EXISTS idx_books_category
ON books(category);

CREATE INDEX IF NOT EXISTS idx_books_created_at
ON books(created_at DESC);

-- Enforce case-insensitive uniqueness on (title, author) so the upload
-- route's duplicate-handling branch (pg error 23505) can trigger.
CREATE UNIQUE INDEX IF NOT EXISTS uq_books_title_author
ON books (lower(title), lower(author));


CREATE TABLE IF NOT EXISTS library (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    book_id BIGINT NOT NULL
        REFERENCES books(id)
        ON DELETE CASCADE,

    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, book_id)
);

CREATE INDEX IF NOT EXISTS idx_library_user_added
ON library(user_id, added_at DESC);


CREATE TABLE IF NOT EXISTS reading_progress (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    book_id BIGINT NOT NULL
        REFERENCES books(id)
        ON DELETE CASCADE,

    page_number INT NOT NULL DEFAULT 1,

    scroll_percent NUMERIC(5,2) NOT NULL DEFAULT 0,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, book_id),

    CONSTRAINT reading_progress_page_check
        CHECK (page_number >= 1),

    CONSTRAINT reading_progress_scroll_check
        CHECK (scroll_percent >= 0 AND scroll_percent <= 100)
);

CREATE INDEX IF NOT EXISTS idx_reading_progress_user_book
ON reading_progress(user_id, book_id);


-- NOTE: RLS is enabled below but no policies are defined. The Node backend
-- connects as the table owner and therefore bypasses RLS. These statements
-- only matter if you later connect using Supabase's anon or authenticated
-- role instead of a direct database connection.

ALTER TABLE users
ENABLE ROW LEVEL SECURITY;

ALTER TABLE books
ENABLE ROW LEVEL SECURITY;

ALTER TABLE library
ENABLE ROW LEVEL SECURITY;

ALTER TABLE reading_progress
ENABLE ROW LEVEL SECURITY;

-- Safe migration for databases created before AI recommendations were added.
ALTER TABLE books ADD COLUMN IF NOT EXISTS embedding JSONB;
ALTER TABLE books ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(150);
ALTER TABLE books ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;