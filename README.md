# 📚 Bookly

**An AI-powered book reading platform.**

Bookly is a web application project that combines a Node.js backend, a PostgreSQL database, a web frontend, and a Python-based AI service.

## 🛠️ Tech Stack

* **Backend:** Node.js, Express
* **Database:** PostgreSQL
* **Storage:** Supabase
* **AI Service:** Python, FastAPI, Sentence Transformers
* **Frontend:** HTML, CSS, JavaScript

## 📁 Project Structure

Bookly/
├── backend/
│   ├── lib/
│   ├── middleware/
│   ├── test/
│   ├── db.js
│   ├── server.js
│   └── supabase.js
├── database/
│   ├── schema.sql
│   └── seed.sql
├── frontend/
│   ├── css/
│   ├── js/
│   └── *.html
├── model/
│   ├── app.py
│   └── requirements.txt
├── render.yaml
├── package.json
├── package-lock.json
└── README.md
   

## 🚀 Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/)
* [PostgreSQL](https://www.postgresql.org/)
* [Python](https://www.python.org/) for the AI service
* [Supabase](https://supabase.com/) for storage

### 1. Clone the Repository

git clone https://github.com/creator-aditya/Bookly.git
cd Bookly
   

### 2. Install Dependencies
  
npm install
   

### 3. Configure Environment Variables

Create a `.env` file in the project root and configure the environment variables required by the backend.

Keep database credentials, authentication secrets, and private storage keys out of source control.

### 4. Start the Backend

Run the development server:
  
npm run dev
Alternatively, use the start script:

npm start
   

### 5. Start the AI Service

Navigate to the model directory:

cd model
Create and activate a Python virtual environment, then install the dependencies:
 
python -m venv .venv
python -m pip install -r requirements.txt
   

Start the service:
uvicorn app:app --host 127.0.0.1 --port 8000
   
This command assumes that `model/app.py` exposes a FastAPI application named `app`.

## 🔗 Repository

**GitHub:** https://github.com/creator-aditya/Bookly
