"""
Hybrid AI Generation Engine
POST /papers/{paper_id}/generate  — fill all empty question slots
POST /sections/questions/{qid}/regenerate — rewrite a single question via AI
"""
import json
import random
import re
import uuid
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
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


class RefineQuestionIn(BaseModel):
    draft_text: str = Field(..., min_length=8)


class GeneratePaperIn(BaseModel):
    pyq_percentage: int | None = Field(None, ge=0, le=100)


def _fallback_chart_spec(topic: str, chart_type: str | None, chart_mode: str | None) -> dict:
    resolved_type = chart_type or "line"
    resolved_mode = chart_mode or "student_plot"
    title = f"{topic} - {'Plot' if resolved_mode == 'student_plot' else 'Analysis'}"
    return {
        "chart_type": resolved_type,
        "title": title,
        "x_label": "X Axis",
        "y_label": "Y Axis",
        "points": [
            {"x": 1, "y": 10},
            {"x": 2, "y": 14},
            {"x": 3, "y": 19},
            {"x": 4, "y": 27},
            {"x": 5, "y": 33},
        ],
    }


def _resolved_chart_spec(generated: dict, topic: str, chart_type: str | None, chart_mode: str | None) -> dict:
    chart_spec = generated.get("chart_spec")
    if isinstance(chart_spec, dict) and chart_spec.get("points"):
        chart_spec.setdefault("chart_type", chart_type or "line")
        chart_spec.setdefault("x_label", "X Axis")
        chart_spec.setdefault("y_label", "Y Axis")
        chart_spec.setdefault("title", f"{topic} - Generated Chart")
        return chart_spec
    return _fallback_chart_spec(topic=topic, chart_type=chart_type, chart_mode=chart_mode)

# ── Prompt builder ────────────────────────────────────────────

def build_question_prompt(
    topic: str,
    q_type: str,
    difficulty: str,
    bloom: str,
    marks: int,
    subject: str,
    requires_chart: bool,
    chart_type: str | None,
    chart_mode: str | None,
) -> str:
    visual_instruction = ""
    if requires_chart:
        resolved_mode = chart_mode or "student_plot"
        mode_instruction = (
            "The student must PLOT the graph using generated values. "
            if resolved_mode == "student_plot"
            else "The student must ANALYZE the provided generated graph. "
        )
        visual_instruction = (
            "\nThis question REQUIRES chart/graph support. "
            + mode_instruction
            + f"Generate numeric values from the topic and return chart_spec using chart_type='{chart_type or 'line'}'. "
            + "chart_spec must include: chart_type, title, x_label, y_label, and points as a list of {x, y}."
        )

    return f"""You are an expert university examiner.
Write ONE exam question with the following requirements:
- Subject: {subject}
- Topic: {topic}
- Question type: {q_type}
- Difficulty: {difficulty}
- Bloom's taxonomy level: {bloom}
- Marks: {marks}
{visual_instruction}

Respond with ONLY valid JSON (no markdown) in this format:
{{
  "text": "The full question text here",
  "options": ["Option A", "Option B", "Option C", "Option D"] or null if not MCQ,
    "answer": "Correct answer or null",
    "chart_spec": null or {{
        "chart_type": "line|bar|scatter|pie",
        "title": "Short chart title",
        "x_label": "X axis label",
        "y_label": "Y axis label",
        "points": [{{"x": number|string, "y": number}}]
    }}
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
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        return json.loads(content.strip())


def build_refine_prompt(
    topic: str,
    q_type: str,
    difficulty: str,
    bloom: str,
    marks: int,
    subject: str,
    draft_text: str,
    requires_chart: bool,
    chart_type: str | None,
    chart_mode: str | None,
) -> str:
    visual_instruction = ""
    if requires_chart:
        resolved_mode = chart_mode or "student_plot"
        mode_instruction = (
            "The student must PLOT the graph using generated values. "
            if resolved_mode == "student_plot"
            else "The student must ANALYZE the provided generated graph. "
        )
        visual_instruction = (
            "\nThis question requires chart/graph support. "
            + mode_instruction
            + f"Use chart_type='{chart_type or 'line'}'. Return chart_spec with x/y labels and points."
        )

    return f"""You are an expert examiner refining a draft exam question.

Requirements:
- Subject: {subject}
- Topic: {topic}
- Question type: {q_type}
- Difficulty: {difficulty}
- Bloom level: {bloom}
- Marks: {marks}
{visual_instruction}

Draft question to refine:
{draft_text}

Respond with ONLY valid JSON:
{{
  "text": "Refined question text",
  "options": ["Option A", "Option B", "Option C", "Option D"] or null,
  "answer": "Correct answer or null",
  "chart_spec": null or {{
    "chart_type": "line|bar|scatter|pie",
    "title": "Short chart title",
    "x_label": "X axis label",
    "y_label": "Y axis label",
    "points": [{{"x": number|string, "y": number}}]
  }}
}}"""


def build_answer_key_prompt(question_text: str, q_type: str, marks: int, subject: str) -> str:
    return f"""You are an expert examiner preparing a concise answer key.
Generate ONLY the model answer for this question.

- Subject: {subject}
- Question type: {q_type}
- Marks: {marks}
- Question text: {question_text}

Respond with ONLY valid JSON (no markdown) in this format:
{{
    "answer": "Concise model answer text"
}}"""


def _parse_mcq_options(raw_options: str | None) -> list[str]:
    if not raw_options:
        return []
    try:
        parsed = json.loads(raw_options) if isinstance(raw_options, str) else raw_options
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [str(opt).strip() for opt in parsed if str(opt).strip()]


def _resolve_correct_option_index(answer: str | None, options: list[str]) -> int | None:
    if not answer or not options:
        return None

    cleaned_answer = answer.strip()
    if not cleaned_answer:
        return None

    upper_answer = cleaned_answer.upper()
    letter_match = re.match(r"^([A-Z])(?:[\)\.\:\-\s].*)?$", upper_answer)
    if letter_match:
        idx = ord(letter_match.group(1)) - ord("A")
        if 0 <= idx < len(options):
            return idx

    normalized_answer = re.sub(r"\s+", " ", cleaned_answer).strip().lower()
    for idx, option in enumerate(options):
        normalized_option = re.sub(r"\s+", " ", option).strip().lower()
        if normalized_option == normalized_answer:
            return idx

    return None


def _extract_mcq_quiz_items(sections: list[Section]) -> tuple[list[dict], list[str]]:
    items: list[dict] = []
    invalid_question_ids: list[str] = []

    for section in sections:
        ordered_questions = sorted(section.questions, key=lambda q: q.order_index)
        for question in ordered_questions:
            if question.q_type != "MCQ":
                continue

            options = _parse_mcq_options(question.options)
            correct_index = _resolve_correct_option_index(question.answer, options)
            if len(options) < 2 or correct_index is None or not question.text.strip():
                invalid_question_ids.append(question.id)
                continue

            item_payload = {
                "title": question.text.strip(),
                "choices": options,
                "correctChoiceIndex": correct_index,
                "points": max(1, int(question.marks or 1)),
            }

            chart_image_url = _build_chart_image_url(question)
            if chart_image_url:
                item_payload["chartImageUrl"] = chart_image_url

            items.append(item_payload)

    return items, invalid_question_ids


def _build_chart_image_url(question: Question) -> str | None:
    if not question.requires_chart or not question.chart_spec:
        return None

    try:
        spec = json.loads(question.chart_spec)
    except json.JSONDecodeError:
        return None

    points = spec.get("points") if isinstance(spec, dict) else None
    if not isinstance(points, list) or not points:
        return None

    chart_type = str(spec.get("chart_type") or question.chart_type or "line").lower()
    x_label = str(spec.get("x_label") or "X")
    y_label = str(spec.get("y_label") or "Y")
    title = str(spec.get("title") or f"{question.topic} Chart")

    labels = [str(p.get("x", "")) for p in points if isinstance(p, dict)]
    y_values = [float(p.get("y", 0)) for p in points if isinstance(p, dict)]

    if not labels or not y_values:
        return None

    if chart_type == "pie":
        config = {
            "type": "pie",
            "data": {
                "labels": labels,
                "datasets": [{"data": y_values}],
            },
            "options": {
                "plugins": {"title": {"display": True, "text": title}},
            },
        }
    elif chart_type == "scatter":
        scatter_points = []
        for p in points:
            if not isinstance(p, dict):
                continue
            try:
                scatter_points.append({"x": float(p.get("x", 0)), "y": float(p.get("y", 0))})
            except (TypeError, ValueError):
                continue
        if not scatter_points:
            return None
        config = {
            "type": "scatter",
            "data": {
                "datasets": [{"label": y_label, "data": scatter_points}],
            },
            "options": {
                "plugins": {"title": {"display": True, "text": title}},
                "scales": {
                    "x": {"title": {"display": True, "text": x_label}},
                    "y": {"title": {"display": True, "text": y_label}},
                },
            },
        }
    else:
        normalized_type = "bar" if chart_type == "bar" else "line"
        config = {
            "type": normalized_type,
            "data": {
                "labels": labels,
                "datasets": [{"label": y_label, "data": y_values}],
            },
            "options": {
                "plugins": {"title": {"display": True, "text": title}},
                "scales": {
                    "x": {"title": {"display": True, "text": x_label}},
                    "y": {"title": {"display": True, "text": y_label}},
                },
            },
        }

    return f"https://quickchart.io/chart?c={quote(json.dumps(config))}"


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


async def _try_bank_by_usage_category(
    db: AsyncSession,
    user_id: str,
    topic: str,
    q_type: str,
    difficulty: str,
    pyq_mode: bool,
    used_ids: set,
) -> QuestionBankEntry | None:
    first_token = (topic or "general").split()[0]
    usage_clause = QuestionBankEntry.usage_count > 0 if pyq_mode else QuestionBankEntry.usage_count == 0
    q = (
        select(QuestionBankEntry)
        .where(
            QuestionBankEntry.created_by == user_id,
            QuestionBankEntry.q_type == q_type,
            QuestionBankEntry.difficulty == difficulty,
            QuestionBankEntry.topic.ilike(f"%{first_token}%"),
            usage_clause,
        )
        .order_by(QuestionBankEntry.usage_count.asc())
        .limit(20)
    )
    res = await db.execute(q)
    candidates = [e for e in res.scalars().all() if e.id not in used_ids]
    return candidates[0] if candidates else None


def _is_placeholder_question(question: Question) -> bool:
    if not question.text:
        return True
    text = question.text.strip().lower()
    if not text:
        return True
    return "will be generated" in text or len(text) <= 30


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/papers/{paper_id}/generate")
async def generate_paper(
    paper_id: str,
    body: GeneratePaperIn | None = None,
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

    # Optional PYQ control mode; default path remains unchanged when unset.
    pyq_percentage = body.pyq_percentage if body else None
    if pyq_percentage is not None:
        pending_questions: list[Question] = []
        for section in sections:
            for question in section.questions:
                if _is_placeholder_question(question):
                    pending_questions.append(question)
                else:
                    results.append({"id": question.id, "source": "existing"})

        total_to_fill = len(pending_questions)
        pyq_target = int((pyq_percentage / 100) * total_to_fill)
        selected_bank_entries: list[QuestionBankEntry] = []

        for idx, question in enumerate(pending_questions):
            use_pyq_pool = idx < pyq_target
            bank_match = None
            if not question.requires_chart:
                bank_match = await _try_bank_by_usage_category(
                    db=db,
                    user_id=current_user.id,
                    topic=question.topic,
                    q_type=question.q_type,
                    difficulty=question.difficulty,
                    pyq_mode=use_pyq_pool,
                    used_ids=used_bank_ids,
                )

            if bank_match:
                question.text = bank_match.text
                question.options = bank_match.options
                question.answer = bank_match.answer
                question.chart_spec = None
                used_bank_ids.add(bank_match.id)
                selected_bank_entries.append(bank_match)
                bank_count += 1
                results.append(
                    {
                        "id": question.id,
                        "source": "bank_pyq" if use_pyq_pool else "bank_new",
                        "bank_id": bank_match.id,
                    }
                )
                continue

            try:
                prompt = build_question_prompt(
                    topic=question.topic,
                    q_type=question.q_type,
                    difficulty=question.difficulty,
                    bloom=question.bloom,
                    marks=question.marks,
                    subject=paper.subject or "General",
                    requires_chart=question.requires_chart,
                    chart_type=question.chart_type,
                    chart_mode=question.chart_mode,
                )
                generated = await _call_openrouter(prompt)
                question.text = generated.get("text", "")
                opts = generated.get("options")
                question.options = json.dumps(opts) if opts else None
                question.answer = generated.get("answer")
                chart_spec = (
                    _resolved_chart_spec(
                        generated,
                        topic=question.topic,
                        chart_type=question.chart_type,
                        chart_mode=question.chart_mode,
                    )
                    if question.requires_chart
                    else None
                )
                question.chart_spec = json.dumps(chart_spec) if chart_spec else None

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
                    usage_count=0,
                )
                db.add(bank_entry)
                selected_bank_entries.append(bank_entry)
                ai_count += 1
                results.append(
                    {
                        "id": question.id,
                        "source": "ai_pyq_fallback" if use_pyq_pool else "ai_new_fallback",
                    }
                )
            except Exception as e:
                results.append({"id": question.id, "source": "error", "detail": str(e)})

        # Increment usage counter for all selected questions (bank or generated).
        for entry in selected_bank_entries:
            entry.usage_count = (entry.usage_count or 0) + 1

        await db.commit()
        return {
            "paper_id": paper_id,
            "total": len(results),
            "from_bank": bank_count,
            "from_ai": ai_count,
            "pyq_percentage": pyq_percentage,
            "pyq_target": pyq_target,
            "results": results,
        }

    for section in sections:
        for question in section.questions:
            # Only fill questions that have placeholder text
            if question.text and "will be generated" not in question.text.lower() and len(question.text) > 30:
                results.append({"id": question.id, "source": "existing"})
                continue

            # 1. Try question bank first
            bank_match = None
            if not question.requires_chart:
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
                question.chart_spec = None
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
                        requires_chart=question.requires_chart,
                        chart_type=question.chart_type,
                        chart_mode=question.chart_mode,
                    )
                    generated = await _call_openrouter(prompt)
                    question.text = generated.get("text", "")
                    opts = generated.get("options")
                    question.options = json.dumps(opts) if opts else None
                    question.answer = generated.get("answer")
                    chart_spec = (
                        _resolved_chart_spec(
                            generated,
                            topic=question.topic,
                            chart_type=question.chart_type,
                            chart_mode=question.chart_mode,
                        )
                        if question.requires_chart
                        else None
                    )
                    question.chart_spec = json.dumps(chart_spec) if chart_spec else None

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
            requires_chart=question.requires_chart,
            chart_type=question.chart_type,
            chart_mode=question.chart_mode,
        )
        generated = await _call_openrouter(prompt)
        question.text = generated.get("text", question.text)
        opts = generated.get("options")
        question.options = json.dumps(opts) if opts else None
        question.answer = generated.get("answer")
        chart_spec = (
            _resolved_chart_spec(
                generated,
                topic=question.topic,
                chart_type=question.chart_type,
                chart_mode=question.chart_mode,
            )
            if question.requires_chart
            else None
        )
        question.chart_spec = json.dumps(chart_spec) if chart_spec else None
        await db.commit()
        await db.refresh(question)
        return question
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


@router.post("/papers/{paper_id}/generate-answer-key")
async def generate_answer_key(
    paper_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate model answers for all questions in a paper."""
    res = await db.execute(select(Paper).where(Paper.id == paper_id, Paper.user_id == current_user.id))
    paper = res.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")

    res = await db.execute(
        select(Section)
        .options(selectinload(Section.questions))
        .where(Section.paper_id == paper_id)
        .order_by(Section.order_index)
    )
    sections = res.scalars().all()

    updated = 0
    errors = []

    for section in sections:
        for question in section.questions:
            if not question.text or not question.text.strip():
                continue

            try:
                prompt = build_answer_key_prompt(
                    question_text=question.text,
                    q_type=question.q_type,
                    marks=question.marks,
                    subject=paper.subject or "General",
                )
                generated = await _call_openrouter(prompt)
                answer = (generated.get("answer") or "").strip()
                if answer:
                    question.answer = answer
                    updated += 1

                if question.requires_chart and not question.chart_spec:
                    fallback = _fallback_chart_spec(
                        topic=question.topic,
                        chart_type=question.chart_type,
                        chart_mode=question.chart_mode,
                    )
                    question.chart_spec = json.dumps(fallback)
            except Exception as e:
                errors.append({"question_id": question.id, "detail": str(e)})

    await db.commit()

    return {
        "paper_id": paper_id,
        "updated": updated,
        "errors": errors,
    }


@router.post("/sections/questions/{question_id}/refine")
async def refine_question(
    question_id: str,
    body: RefineQuestionIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Refine edited question text through LLM while preserving slot constraints."""
    res = await db.execute(
        select(Question)
        .join(Section, Section.id == Question.section_id)
        .join(Paper, Paper.id == Section.paper_id)
        .where(Question.id == question_id, Paper.user_id == current_user.id)
    )
    question = res.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found.")

    res2 = await db.execute(
        select(Paper.subject)
        .join(Section, Section.paper_id == Paper.id)
        .where(Section.id == question.section_id)
    )
    subject = res2.scalar_one_or_none() or "General"

    try:
        prompt = build_refine_prompt(
            topic=question.topic,
            q_type=question.q_type,
            difficulty=question.difficulty,
            bloom=question.bloom,
            marks=question.marks,
            subject=subject,
            draft_text=body.draft_text,
            requires_chart=question.requires_chart,
            chart_type=question.chart_type,
            chart_mode=question.chart_mode,
        )
        generated = await _call_openrouter(prompt)
        question.text = generated.get("text", body.draft_text)
        opts = generated.get("options")
        question.options = json.dumps(opts) if opts else None
        question.answer = generated.get("answer")
        chart_spec = (
            _resolved_chart_spec(
                generated,
                topic=question.topic,
                chart_type=question.chart_type,
                chart_mode=question.chart_mode,
            )
            if question.requires_chart
            else None
        )
        question.chart_spec = json.dumps(chart_spec) if chart_spec else None
        await db.commit()
        await db.refresh(question)
        return question
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Question refinement failed: {str(e)}")


@router.post("/papers/{paper_id}/host-test")
async def host_test(
    paper_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not settings.APPS_SCRIPT_WEBHOOK_URL:
        raise HTTPException(
            status_code=503,
            detail="Google Forms host integration is not configured on server.",
        )

    res = await db.execute(select(Paper).where(Paper.id == paper_id, Paper.user_id == current_user.id))
    paper = res.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")

    res = await db.execute(
        select(Section)
        .options(selectinload(Section.questions))
        .where(Section.paper_id == paper_id)
        .order_by(Section.order_index)
    )
    sections = res.scalars().all()

    quiz_items, invalid_ids = _extract_mcq_quiz_items(sections)
    if not quiz_items:
        raise HTTPException(status_code=400, detail="No valid MCQ questions found to host.")
    if invalid_ids:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Some MCQs are missing valid options/correct answers and cannot be hosted.",
                "question_ids": invalid_ids,
            },
        )

    payload = {
        "title": f"{paper.title} - Online Test",
        "description": f"Auto-hosted quiz for {paper.subject or 'Exam Paper'}",
        "isQuiz": True,
        "shuffleQuestions": True,
        "shuffleOptions": True,
        "questions": quiz_items,
    }
    headers = {"Content-Type": "application/json"}
    if settings.APPS_SCRIPT_API_KEY:
        headers["X-API-Key"] = settings.APPS_SCRIPT_API_KEY

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                settings.APPS_SCRIPT_WEBHOOK_URL,
                json=payload,
                headers=headers,
                timeout=float(settings.APPS_SCRIPT_TIMEOUT_SECONDS),
                follow_redirects=True,
            )
        response.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to create Google Form quiz: {str(e)}")

    data = response.json() if response.content else {}
    form_url = (
        data.get("formUrl")
        or data.get("form_url")
        or data.get("shareableLink")
        or data.get("shareable_link")
        or data.get("url")
    )
    if not form_url:
        raise HTTPException(status_code=502, detail="Apps Script response missing shareable form URL.")

    return {
        "paper_id": paper_id,
        "questions_hosted": len(quiz_items),
        "form_url": form_url,
        "edit_url": data.get("editUrl") or data.get("edit_url"),
    }
