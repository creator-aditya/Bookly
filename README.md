# 📚 Bookly — An AI Digital Reading Platform

Bookly is an AI-integrated digital reading platform designed to bring book discovery, digital reading, and personalized experiences together in one place.

The project combines full-stack web development with AI technologies to explore a smarter and more engaging reading experience.

## ✨ Features

* 📖 **Digital Reading:** A dedicated interface for accessing and reading books.
* 🔍 **Book Discovery:** Browse and explore available books.
* 👤 **User Authentication:** Authentication-related frontend and backend components.
* 📚 **Personal Library:** A dedicated space for readers' library experience.
* 🤖 **AI Integration:** A Python-based service for text embeddings and semantic processing.
* 🛠️ **Administration:** An interface for administrative functionality.
* 💳 **Purchase Interface:** Dedicated pages and scripts for book purchasing functionality.

*Feature availability depends on the current implementation.*

## 🛠️ Tech Stack

| Technology            | Purpose                       |
| --------------------- | ----------------------------- |
| HTML, CSS, JavaScript | Frontend                      |
| Node.js, Express.js   | Backend and APIs              |
| PostgreSQL, Supabase  | Database and backend services |
| Python, FastAPI       | AI service                    |
| Sentence Transformers | Text embeddings               |
| Git, GitHub           | Version control               |

## 📁 Project Structure

```text
Bookly/
├── backend/          # Server, APIs, middleware, and utilities
├── database/         # SQL schema and seed data
├── frontend/         # HTML, CSS, and JavaScript
├── model/            # Python AI service
├── package.json      # Dependencies and scripts
├── render.yaml       # Deployment configuration
└── README.md
```

## 🚀 Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/)
* [Git](https://git-scm.com/)
* Python, if running the AI service
* PostgreSQL or configured Supabase resources

### 1. Clone the Repository

```bash
git clone https://github.com/creator-aditya/Bookly.git
cd Bookly
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create your local environment file from the example:

```powershell
Copy-Item .env.example .env
```

Configure the required variables in `.env` according to your application setup.

### 4. Start the Application

Run the development script configured in `package.json`:

```bash
npm run dev
```

For the AI service, install the dependencies listed in `model/requirements.txt` and follow the startup configuration in `model/app.py`.

## 🔒 Security

* Never commit `.env` files, API keys, passwords, or database credentials.
* Validate authentication and authorization on the backend.
* Protect uploaded files and private resources.
* Verify payment transactions on the server if payment processing is enabled.

## 🛣️ Future Improvements

* Personalized AI-powered book recommendations
* Reading progress tracking
* Interactive page-turning reader
* Customizable highlights and notes
* Improved account recovery
* Enhanced reading and purchasing experiences

## 👨‍💻 Author

**Aditya Yadav**

* GitHub: [@creator-aditya](https://github.com/creator-aditya)
* Repository: [Bookly](https://github.com/creator-aditya/Bookly)

---

<p align="center">
  <strong>Bookly — Exploring a better digital reading experience.</strong>
</p>
