# Bookly AI Service

Bookly uses `sentence-transformers/all-MiniLM-L6-v2` to create 384-dimensional book embeddings.

## Run locally

```bash
cd model
python -m pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8000
```

The model is loaded once when FastAPI starts.

### Endpoints

- `GET /health` — service/model health check
- `POST /embed` — accepts `title`, `author`, `genre`, `category`, and `description` (or a prebuilt `text`) and returns a 384-dimensional embedding

The Node backend uses `AI_SERVICE_URL` to call this service.
