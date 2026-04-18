# Quantum Arena / ExamForge System README

This repository contains a complete **AI-assisted exam paper generation platform** made of two applications:

- **`paper-weaver`** → Frontend (TanStack Start + React + TypeScript)
- **`examforge-api`** → Backend API (FastAPI + SQLAlchemy + Alembic)

Together, they provide an end-to-end flow for educators to create, generate, edit, analyze, and export exam papers.

---

## 1) What this project is

The system is designed for academic paper creation workflows where a teacher can:

1. Provide a paper pattern (upload or manual description)
2. Let AI convert it into a structured blueprint
3. Generate questions using a **hybrid engine** (question bank first, AI fallback)
4. Edit/rewrite/regenerate individual questions
5. Generate answer keys
6. Export papers in multiple formats (PDF, DOC, HTML, TXT, LaTeX)

This is not just a generator; it is a full authoring workspace with persistent papers, sections, questions, and reusable bank entries.

---

## 2) High-level architecture

### Frontend (`paper-weaver`)
- Multi-step paper creation wizard (Pattern → Details → Blueprint → Live Paper → Export)
- Dashboard for recent papers and quick actions
- Auth screens with local token storage
- Analytics page (UI insights/charts)
- Calls backend via `VITE_API_URL`

### Backend (`examforge-api`)
- JWT-based authentication
- CRUD APIs for papers, sections, questions, question bank
- AI endpoints for:
  - parsing exam pattern to JSON blueprint
  - generating questions
  - regenerating/refining one question
  - generating answer keys
- Async SQLAlchemy models with Alembic migrations

### Storage and data flow
- Default DB config supports SQLite (in-app file), `.env.example` shows PostgreSQL-style values
- Every paper belongs to a user
- Sections belong to papers
- Questions belong to sections
- Question bank entries are reused for generation optimization

---

## 3) Core system workflow

1. User logs in/registers.
2. User starts paper creation.
3. Pattern input is parsed by LLM into blueprint slots (topic/type/difficulty/bloom/marks/chart requirements).
4. Metadata and blueprint are saved.
5. Generation endpoint fills empty slots:
   - tries question bank match first
   - falls back to OpenRouter model if no suitable bank match
   - stores AI outputs back into question bank for future reuse
6. User edits questions in live view:
   - star/unstar
   - delete/add
   - regenerate one question
   - refine edited text with AI
7. User exports paper and optionally answer keys in chosen format.

---

## 4) Full filesystem structure

```text
quantum-arena/
├── examforge-api/
│   ├── .env.example
│   ├── alembic.ini
│   ├── examforge.db
│   ├── pytest.ini
│   ├── requirements.txt
│   ├── alembic/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │       ├── 0001_create_users.py
│   │       ├── 0002_create_papers.py
│   │       ├── 0003_create_sections_questions.py
│   │       ├── 0004_create_question_bank.py
│   │       ├── 0005_add_chart_fields_to_questions.py
│   │       └── 0006_add_chart_mode_to_questions.py
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── dependencies.py
│   │   ├── security.py
│   │   ├── lib/
│   │   │   ├── __init__.py
│   │   │   ├── openrouter.py
│   │   │   └── parsers.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── paper.py
│   │   │   ├── section.py
│   │   │   ├── question.py
│   │   │   └── question_bank.py
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── papers.py
│   │   │   ├── sections.py
│   │   │   ├── questions.py
│   │   │   ├── question_bank.py
│   │   │   └── generation.py
│   │   └── schemas/
│   │       ├── __init__.py
│   │       ├── auth.py
│   │       ├── paper.py
│   │       ├── section.py
│   │       └── question_bank.py
│   └── tests/
│       └── test_auth.py
└── paper-weaver/
    ├── .env
    ├── components.json
    ├── eslint.config.js
    ├── package.json
    ├── package-lock.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── wrangler.jsonc
    ├── src/
    │   ├── styles.css
    │   ├── routeTree.gen.ts
    │   ├── router.tsx
    │   ├── hooks/
    │   │   └── use-mobile.tsx
    │   ├── components/
    │   │   ├── AppShell.tsx
    │   │   └── ui/ (shared UI component library)
    │   ├── lib/
    │   │   ├── api.ts
    │   │   ├── authService.ts
    │   │   ├── papersService.ts
    │   │   ├── sectionsService.ts
    │   │   ├── paperExport.ts
    │   │   └── utils.ts
    │   └── routes/
    │       ├── __root.tsx
    │       ├── auth.tsx
    │       ├── index.tsx
    │       ├── create.tsx
    │       └── analytics.tsx
    ├── bun.lockb
    └── bunfig.toml
```

---

## 5) Backend API overview

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

### Papers
- `GET /papers`
- `POST /papers`
- `GET /papers/{paper_id}`
- `PATCH /papers/{paper_id}`
- `DELETE /papers/{paper_id}`
- `POST /papers/parse-pattern`

### Sections and Questions
- `GET /papers/{paper_id}/sections`
- `POST /papers/{paper_id}/sections`
- `PATCH /papers/sections/{section_id}`
- `DELETE /papers/sections/{section_id}`
- `PUT /papers/sections/{section_id}/reorder`
- `GET /sections/{section_id}/questions`
- `POST /sections/{section_id}/questions`
- `PATCH /sections/questions/{question_id}`
- `DELETE /sections/questions/{question_id}`
- `PATCH /sections/questions/{question_id}/star`

### AI Generation
- `POST /papers/{paper_id}/generate`
- `POST /sections/questions/{question_id}/regenerate`
- `POST /sections/questions/{question_id}/refine`
- `POST /papers/{paper_id}/generate-answer-key`

### Question Bank
- `GET /bank`
- `POST /bank`
- `GET /bank/{entry_id}`
- `PATCH /bank/{entry_id}`
- `DELETE /bank/{entry_id}`

### Health
- `GET /health`

---

## 6) Environment configuration

## Backend (`examforge-api/.env`)

Supported settings in `app/config.py`:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `REFRESH_TOKEN_EXPIRE_DAYS`
- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL`
- `OPENROUTER_MODEL`

> Without `OPENROUTER_API_KEY`, AI parsing/generation endpoints cannot produce model output.

## Frontend (`paper-weaver/.env`)

- `VITE_API_URL=http://localhost:8000`

---

## 7) Local development setup

## A) Run backend

```bash
cd /home/runner/work/quantum-arena/quantum-arena/examforge-api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

## B) Run frontend

```bash
cd /home/runner/work/quantum-arena/quantum-arena/paper-weaver
npm ci
npm run dev
```

Default frontend runs on Vite dev server (typically `http://localhost:5173`), backend on `http://localhost:8000`.

---

## 8) Build, lint, and test commands

### Frontend (`paper-weaver`)
- `npm run lint`
- `npm run build`
- `npm run preview`

### Backend (`examforge-api`)
- `python -m pytest`

---

## 9) Security and auth model

- Passwords are hashed with bcrypt.
- API auth uses Bearer JWT tokens.
- Protected routes resolve current user from access token.
- Most data endpoints enforce ownership checks (paper/section/question scoped to authenticated user).

---

## 10) Export capabilities

The frontend export module supports:

- Paper text generation
- HTML paper rendering
- DOC export (HTML-based Word-compatible document)
- PDF export via `jsPDF`
- LaTeX (`.tex`) export
- Answer-key-only TXT export
- Browser preview window and print flow

Chart-aware questions are included in export logic with:
- data-point table support
- generated visual chart support for graph analysis mode

---

## 11) Practical notes for contributors

- Keep API and UI schema fields aligned (question type, difficulty, bloom, chart fields).
- `create.tsx` is the core orchestration screen for the full exam workflow.
- `generation.py` and `openrouter.py` are core AI-path backend files.
- Alembic migrations in `examforge-api/alembic/versions` define DB evolution.
- Shared frontend API clients are in `paper-weaver/src/lib/*Service.ts`.

---

## 12) Project vision summary

ExamForge in this repository is a **production-style academic authoring pipeline**:
- structured creation,
- AI-assisted generation,
- human review/edit control,
- reusable knowledge base (question bank),
- and multi-format publishing.

It is optimized for institutions or educators who need quality exam papers quickly while preserving full editorial control.

