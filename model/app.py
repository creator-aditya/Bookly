from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIMENSIONS = 384

app = FastAPI(title="Bookly AI Service", version="1.0.0")

# Load the model once when the process starts.
model = SentenceTransformer(MODEL_NAME)


class BookEmbeddingRequest(BaseModel):
    text: Optional[str] = None
    title: Optional[str] = None
    author: Optional[str] = None
    genre: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None


def build_book_text(data: BookEmbeddingRequest) -> str:
    if data.text and data.text.strip():
        return data.text.strip()

    fields = [
        ("Title", data.title),
        ("Author", data.author),
        ("Genre", data.genre),
        ("Category", data.category),
        ("Description", data.description),
    ]

    parts = [
        f"{label}: {value.strip()}"
        for label, value in fields
        if value and value.strip()
    ]

    return "\n".join(parts)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "dimensions": EMBEDDING_DIMENSIONS,
    }


@app.post("/embed")
def create_embedding(data: BookEmbeddingRequest):
    text = build_book_text(data)

    if not text:
        raise HTTPException(status_code=400, detail="Book text or book metadata is required.")

    embedding = model.encode(
        text,
        normalize_embeddings=True
    ).tolist()

    if len(embedding) != EMBEDDING_DIMENSIONS:
        raise HTTPException(status_code=500, detail="Unexpected embedding dimension.")

    return {
        "embedding": embedding,
        "dimensions": len(embedding),
        "model": MODEL_NAME,
        "text": text,
    }
