from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, papers, sections, questions, question_bank, generation

app = FastAPI(
    title="ExamForge API",
    description="Backend for ExamForge — AI-powered exam paper generator",
    version="1.0.0",
)

# ── CORS ───────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite default
        "http://localhost:3000",
        "http://localhost:4173",  # Vite preview
        "http://localhost:8080",  # TanStack Start default
        "http://localhost:8081",  # TanStack Start (fallback)
        "http://localhost:8082",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:8081",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ─────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(papers.router)
app.include_router(sections.router)
app.include_router(questions.router)
app.include_router(question_bank.router)
app.include_router(generation.router)


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "examforge-api"}
