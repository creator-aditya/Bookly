# 📚 Bookly

**An AI-powered book reading platform — discover, read, and track your library.**

[![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Storage-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-AI_Service-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)


---

## ✨ What is Bookly?

Bookly is a full-stack web application for readers. It pairs a Node/Express backend and a Postgres database with a Python AI service that generates semantic embeddings of every book, so recommendations are based on what a book is *about* — not just its category tag.

Upload a PDF or EPUB as an admin, and Bookly stores the file in Supabase, extracts its metadata, generates a 384-dimensional embedding, and serves it to readers with progress tracking.

## 🚀 Features

| Feature | Description |
|---|---|
| 🔐 **JWT Authentication** | Register, log in, 18+ age gate, disposable-email blocklist |
| 📖 **Book Catalog** | Browse, search by title/author, filter by category |
| 📚 **My Library** | Save books, resume where you left off |
| 📤 **Admin Upload** | PDF / EPUB upload with automatic metadata extraction |
| 🧠 **AI Recommendations** | Sentence-transformer embeddings + cosine similarity |
| 📄 **In-Browser Reader** | PDFs stream directly from the server, no downloads |
| 💾 **Reading Progress** | Page and scroll position saved per user, per book |

## 🛠️ Tech Stack

**Backend**
- Node.js 22 + Express 5
- PostgreSQL 18 (via `pg`)
- JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`)
- Multer for file uploads
- Helmet for security headers

**Storage**
- Supabase Storage (private `books` bucket, signed access)

**AI Service**
- FastAPI + `sentence-transformers/all-MiniLM-L6-v2`
- 384-dimensional embeddings, cosine similarity ranking

**Frontend**
- Vanilla HTML / CSS / JavaScript
- No build step — served statically by Express

## 📁 Project Structure

bookly/
├── backend/
│   ├── lib/              # extractMetadata, helpers
│   ├── middleware/       # auth
│   ├── test/             # node:test suites
│   ├── db.js             # pg Pool
│   ├── server.js         # Express app
│   └── supabase.js       # Supabase client
├── database/
│   ├── schema.sql        # tables, indexes, RLS
│   └── seed.sql          # starter books
├── frontend/
│   ├── css/  js/
│   └── *.html            # landing, discover, library, reader, admin
├── model/                # FastAPI AI service
│   ├── app.py
│   └── requirements.txt
├── render.yaml           # Render deploy config
└── package.json

## ⚡ Quick Start

### Prerequisites

- Node.js 22+
- PostgreSQL 15+
- Python 3.10+ *(optional, for AI recommendations)*
- A Supabase project *(for file storage)*

### 1. Clone and install

git clone https://github.com/creator-aditya/Bookly.git
cd Bookly
npm install

2. Set up the database

createdb bookly
psql -d bookly -f database/schema.sql
psql -d bookly -f database/seed.sql   # optional seed books

3. Configure environment
Create a .env file at the project root:

env
PORT=3000
DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/bookly
JWT_SECRET=generate-a-random-string-at-least-32-chars
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AI_SERVICE_URL=http://127.0.0.1:8000
AI_REQUEST_TIMEOUT_MS=15000

4. Start the AI service (optional)

cd model
python -m pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8000

The app works without this — recommendations fall back to cold-start ordering.

5. Run Bookly
npm run dev
Open http://localhost:3000

🧪 Tests
node --test backend/test/

📜 License
MIT
