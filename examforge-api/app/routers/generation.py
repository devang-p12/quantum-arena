"""
Hybrid AI Generation Engine
POST /papers/{paper_id}/generate  — fill all empty question slots
POST /sections/questions/{qid}/regenerate — rewrite a single question via AI
"""
import json
import random
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.models.paper import Paper
from app.models.question import Question
from app.models.question_bank import QuestionBankEntry
from app.models.section import Section
from app.models.user import User

router = APIRouter(tags=["AI Generation"])

# ── Prompt builder ────────────────────────────────────────────

def build_question_prompt(topic: str, q_type: str, difficulty: str, bloom: str, marks: int, subject: str) -> str:
    return f"""You are an expert university examiner.
Write ONE exam question with the following requirements:
- Subject: {subject}
- Topic: {topic}
- Question type: {q_type}
- Difficulty: {difficulty}
- Bloom's taxonomy level: {bloom}
- Marks: {marks}

Respond with ONLY valid JSON (no markdown) in this format:
{{
  "text": "The full question text here",
  "options": ["Option A", "Option B", "Option C", "Option D"] or null if not MCQ,
  "answer": "Correct answer or null"
}}"""


async def _call_openrouter(prompt: str) -> dict:
    """Call OpenRouter and return parsed question JSON."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "HTTP-Referer": "http://localhost:8081",
                "X-Title": "ExamForge API",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.OPENROUTER_MODEL,
                "messages": [
                    {"role": "system", "content": "You are a JSON-only API. Output valid JSON only, no markdown."},
                    {"role": "user", "content": prompt},
                ],
                "response_format": {"type": "json_object"},
            },
            timeout=30.0,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        return json.loads(content.strip())


async def _try_bank(
    db: AsyncSession,
    topic: str,
    q_type: str,
    difficulty: str,
    bloom: str,
    used_ids: set,
) -> QuestionBankEntry | None:
    """Search the question bank for a matching unused entry."""
    q = (
        select(QuestionBankEntry)
        .where(
            QuestionBankEntry.q_type == q_type,
            QuestionBankEntry.difficulty == difficulty,
            QuestionBankEntry.topic.ilike(f"%{topic.split()[0]}%"),  # fuzzy by first keyword
        )
        .order_by(QuestionBankEntry.usage_count.asc())
        .limit(20)
    )
    res = await db.execute(q)
    candidates = [e for e in res.scalars().all() if e.id not in used_ids]
    return random.choice(candidates) if candidates else None


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/papers/{paper_id}/generate")
async def generate_paper(
    paper_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify paper ownership
    res = await db.execute(select(Paper).where(Paper.id == paper_id, Paper.user_id == current_user.id))
    paper = res.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")

    # Load all sections + questions
    res = await db.execute(
        select(Section)
        .options(selectinload(Section.questions))
        .where(Section.paper_id == paper_id)
        .order_by(Section.order_index)
    )
    sections = res.scalars().all()

    used_bank_ids: set = set()
    bank_count = 0
    ai_count = 0
    results = []

    for section in sections:
        for question in section.questions:
            # Only fill questions that have placeholder text
            if question.text and "will be generated" not in question.text.lower() and len(question.text) > 30:
                results.append({"id": question.id, "source": "existing"})
                continue

            # 1. Try question bank first
            bank_match = await _try_bank(
                db,
                topic=question.topic,
                q_type=question.q_type,
                difficulty=question.difficulty,
                bloom=question.bloom,
                used_ids=used_bank_ids,
            )

            if bank_match:
                # Fill from bank
                question.text = bank_match.text
                question.options = bank_match.options
                question.answer = bank_match.answer
                bank_match.usage_count += 1
                used_bank_ids.add(bank_match.id)
                bank_count += 1
                results.append({"id": question.id, "source": "bank", "bank_id": bank_match.id})
            else:
                # 2. Fall back to OpenRouter AI
                try:
                    prompt = build_question_prompt(
                        topic=question.topic,
                        q_type=question.q_type,
                        difficulty=question.difficulty,
                        bloom=question.bloom,
                        marks=question.marks,
                        subject=paper.subject or "General",
                    )
                    generated = await _call_openrouter(prompt)
                    question.text = generated.get("text", "")
                    opts = generated.get("options")
                    question.options = json.dumps(opts) if opts else None
                    question.answer = generated.get("answer")

                    # Save to question bank for future reuse
                    bank_entry = QuestionBankEntry(
                        id=str(uuid.uuid4()),
                        created_by=current_user.id,
                        topic=question.topic,
                        q_type=question.q_type,
                        difficulty=question.difficulty,
                        bloom=question.bloom,
                        marks=question.marks,
                        text=question.text,
                        options=question.options,
                        answer=question.answer,
                        is_ai_generated=True,
                    )
                    db.add(bank_entry)
                    ai_count += 1
                    results.append({"id": question.id, "source": "ai"})
                except Exception as e:
                    results.append({"id": question.id, "source": "error", "detail": str(e)})

    await db.commit()

    return {
        "paper_id": paper_id,
        "total": len(results),
        "from_bank": bank_count,
        "from_ai": ai_count,
        "results": results,
    }


@router.post("/sections/questions/{question_id}/regenerate")
async def regenerate_question(
    question_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-generate the text for a single question using AI."""
    # Fetch question and verify ownership via join
    res = await db.execute(
        select(Question)
        .join(Section, Section.id == Question.section_id)
        .join(Paper, Paper.id == Section.paper_id)
        .where(Question.id == question_id, Paper.user_id == current_user.id)
    )
    question = res.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found.")

    # Get paper subject
    res2 = await db.execute(
        select(Paper.subject)
        .join(Section, Section.paper_id == Paper.id)
        .where(Section.id == question.section_id)
    )
    subject = res2.scalar_one_or_none() or "General"

    try:
        prompt = build_question_prompt(
            topic=question.topic,
            q_type=question.q_type,
            difficulty=question.difficulty,
            bloom=question.bloom,
            marks=question.marks,
            subject=subject,
        )
        generated = await _call_openrouter(prompt)
        question.text = generated.get("text", question.text)
        opts = generated.get("options")
        question.options = json.dumps(opts) if opts else None
        question.answer = generated.get("answer")
        await db.commit()
        await db.refresh(question)
        return question
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")
