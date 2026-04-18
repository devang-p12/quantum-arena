# ExamForge README (Quantum Arena Repository)

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

### Detailed feature breakdown

#### A) Authoring and paper design
- Guided 5-step creation wizard to reduce manual mistakes during setup.
- Metadata-driven paper definition (subject, duration, marks, institution, exam type, semester).
- Section-wise blueprint modeling with editable question slots.
- Slot attributes include question type, topic, marks, difficulty, Bloom level, and chart requirements.

#### B) AI-assisted content generation
- Pattern parsing from file/text into structured JSON blueprint.
- Hybrid generation strategy:
  - **Question bank reuse first** for consistency and speed.
  - **LLM fallback** when a good bank match is unavailable.
- Per-question AI operations:
  - regenerate (rewrite the full question)
  - refine (improve user-edited draft while preserving constraints)
- AI answer-key generation for existing questions.

#### C) Live editing and quality control
- Inline edit/save workflow directly in the live paper view.
- Question-level operations: add, delete, star, regenerate, refine.
- Support for chart-based questions:
  - student plots from generated data points
  - student analyzes generated graph
- Section-level and paper-level structure remains editable before export.

#### D) Export and distribution
- Export formats: PDF, DOC, HTML, TXT, LaTeX.
- Optional inclusion of answer keys in exports.
- Answer-key-only export for quick evaluator distribution.
- Preview/print support for browser-based review before download.

---

## 3) Core system workflow (detailed)

### 3.1 End-to-end operational workflow
1. **Authentication:** User registers/signs in and receives JWT tokens.
2. **Pattern capture:** User uploads a pattern file or writes a manual pattern description.
3. **Blueprint parsing:** Backend parses pattern with LLM into a section/question-slot blueprint.
4. **Paper creation:** Frontend saves paper metadata and creates a persisted paper record.
5. **Blueprint sync:** Sections and question slots are created in database with ordering and constraints.
6. **Hybrid generation:** Backend fills slots from bank-first matching, then AI fallback where needed.
7. **Knowledge retention:** AI-generated items are added to question bank for future reuse.
8. **Live editing:** User edits, regenerates, refines, stars, and manages each question.
9. **Answer key generation:** Optional model answers are generated across the paper.
10. **Export/distribution:** User previews and exports in required format(s).

### 3.2 Detailed generation pipeline
1. Read all sections/questions for a paper.
2. Skip questions that already have meaningful text.
3. For each unfilled question:
   - attempt bank lookup using topic/type/difficulty/bloom signals
   - if matched, use bank content and increase usage count
   - if not matched, call OpenRouter with strict JSON prompt
4. Persist generated text/options/answers/chart data.
5. Commit updated paper and return source-wise generation stats.

### 3.3 User flow (what the educator experiences)
1. **Landing / Login**
   - Access auth page
   - Register or sign in
2. **Dashboard**
   - View recent papers and quick actions
   - Open creation flow
3. **Step 1: Pattern**
   - Upload pattern OR provide manual instructions OR start from template
   - Select paper style (Theoretical / MCQ / Viva / Internal Assessment)
4. **Step 2: Details**
   - Fill metadata (subject, duration, marks, institution, exam type, etc.)
5. **Step 3: Blueprint**
   - Review sections/question slots
   - Adjust question type, marks, difficulty, Bloom level, chart mode
6. **Step 4: Live Paper**
   - Inspect generated questions
   - Regenerate weak items
   - Edit and refine wording
   - Add/remove/star questions
7. **Step 5: Export**
   - Download PDF/DOC/HTML/TXT/LaTeX
   - Include answers or generate dedicated answer key

### 3.4 Common practical user journeys
- **First-time user journey:** Register → create first paper from manual pattern → generate → refine → export PDF.
- **Returning faculty journey:** Open dashboard → create a new paper and adapt the blueprint from previous patterns → generate quickly with stronger bank reuse.
- **Quality improvement journey:** Identify weak questions in live view → regenerate/refine specific items → regenerate answer key → export final paper pack.

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

### Backend (`examforge-api/.env`)

Supported settings in `app/config.py`:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `REFRESH_TOKEN_EXPIRE_DAYS`
- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL`
- `OPENROUTER_MODEL`

OpenRouter key behavior notes:
- Configure `OPENROUTER_API_KEY` before using AI features.
- If the key is missing, AI endpoints fail instead of returning generated content.
- Current behavior includes errors such as `AI Parsing failed: OPENROUTER_API_KEY is not configured.` and AI routes commonly returning HTTP 500 responses.
- Recommended future enhancement: return a clearer message like `OpenRouter API key is required. Set OPENROUTER_API_KEY in .env.` with a dedicated status code such as HTTP 503.

### Frontend (`paper-weaver/.env`)

- `VITE_API_URL=http://localhost:8000`

---

## 7) Local development setup

### A) Run backend

```bash
cd examforge-api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### B) Run frontend

```bash
cd paper-weaver
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
