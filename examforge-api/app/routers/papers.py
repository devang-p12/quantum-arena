import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, File, Form, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.paper import Paper
from app.models.question import Question
from app.models.question_bank import QuestionBankEntry
from app.models.section import Section
from app.models.user import User
from app.schemas.paper import PaperCreate, PaperListOut, PaperOut, PaperUpdate
from app.lib.parsers import extract_text_from_file
from app.lib.openrouter import parse_blueprint_to_json

router = APIRouter(prefix="/papers", tags=["Papers"])


@router.get("", response_model=PaperListOut)
async def list_papers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Paper).where(Paper.user_id == current_user.id)
    if status:
        q = q.where(Paper.status == status)
    if subject:
        q = q.where(Paper.subject.ilike(f"%{subject}%"))

    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar_one()

    q = q.order_by(Paper.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    papers = result.scalars().all()

    return PaperListOut(items=list(papers), total=total, page=page, page_size=page_size)


@router.post("", response_model=PaperOut, status_code=status.HTTP_201_CREATED)
async def create_paper(
    body: PaperCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    paper = Paper(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        **body.model_dump(),
    )
    db.add(paper)
    await db.commit()
    await db.refresh(paper)
    return paper


@router.get("/{paper_id:uuid}", response_model=PaperOut)
async def get_paper(
    paper_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    paper = await _get_owned_paper(str(paper_id), current_user.id, db)
    return paper


@router.patch("/{paper_id:uuid}", response_model=PaperOut)
async def update_paper(
    paper_id: uuid.UUID,
    body: PaperUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    paper = await _get_owned_paper(str(paper_id), current_user.id, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(paper, field, value)

    # Whenever a paper is marked Complete, ensure all its questions are available in the question bank.
    if paper.status == "Complete":
        await _sync_complete_paper_questions_to_bank(paper.id, current_user.id, db)

    await db.commit()
    await db.refresh(paper)
    return paper


@router.delete("/{paper_id:uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_paper(
    paper_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    paper = await _get_owned_paper(str(paper_id), current_user.id, db)
    await db.delete(paper)
    await db.commit()


@router.post("/parse-pattern")
async def parse_pattern(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    exam_type: Optional[str] = Form(None),
):
    if not file and not text:
        raise HTTPException(status_code=400, detail="Must provide either a file or text description.")
    
    raw_text = ""
    if file:
        content = await file.read()
        raw_text = extract_text_from_file(content, file.filename)
    if text:
        raw_text += "\n" + text
        
    try:
        blueprint = await parse_blueprint_to_json(raw_text, exam_type=exam_type)
        return blueprint
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Parsing failed: {str(e)}")


@router.get("/_metrics")
@router.get("/dashboard/metrics")
async def get_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Paper counts
    paper_rows = await db.execute(
        select(Paper.status, Paper.subject, Paper.created_at).where(Paper.user_id == current_user.id)
    )
    papers = paper_rows.all()
    papers_total = len(papers)
    completed_papers = sum(1 for p in papers if p.status == "Complete")
    active_subjects = len({(p.subject or "").strip().lower() for p in papers if (p.subject or "").strip()})

    # Question and bank counts
    q_count_res = await db.execute(
        select(func.count(Question.id))
        .select_from(Question)
        .join(Section, Section.id == Question.section_id)
        .join(Paper, Paper.id == Section.paper_id)
        .where(Paper.user_id == current_user.id)
    )
    total_questions = q_count_res.scalar_one() or 0

    bank_count_res = await db.execute(
        select(func.count(QuestionBankEntry.id)).where(QuestionBankEntry.created_by == current_user.id)
    )
    question_bank_total = bank_count_res.scalar_one() or 0

    # Subject distribution by papers
    subject_rows = await db.execute(
        select(Paper.subject, func.count(Paper.id))
        .where(Paper.user_id == current_user.id)
        .group_by(Paper.subject)
    )
    by_subject = [
        {"name": s or "Unknown", "papers": c}
        for s, c in subject_rows.all()
    ]

    # Difficulty and bloom distributions by questions
    diff_rows = await db.execute(
        select(Question.difficulty, func.count(Question.id))
        .select_from(Question)
        .join(Section, Section.id == Question.section_id)
        .join(Paper, Paper.id == Section.paper_id)
        .where(Paper.user_id == current_user.id)
        .group_by(Question.difficulty)
    )
    difficulty_counts = {k or "Medium": v for k, v in diff_rows.all()}
    total_diff = sum(difficulty_counts.values()) or 1
    difficulty = [
        {"name": "Easy", "value": round((difficulty_counts.get("Easy", 0) * 100) / total_diff)},
        {"name": "Medium", "value": round((difficulty_counts.get("Medium", 0) * 100) / total_diff)},
        {"name": "Hard", "value": round((difficulty_counts.get("Hard", 0) * 100) / total_diff)},
    ]

    bloom_rows = await db.execute(
        select(Question.bloom, func.count(Question.id))
        .select_from(Question)
        .join(Section, Section.id == Question.section_id)
        .join(Paper, Paper.id == Section.paper_id)
        .where(Paper.user_id == current_user.id)
        .group_by(Question.bloom)
    )
    bloom_map = {k or "Understand": v for k, v in bloom_rows.all()}
    bloom_levels = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"]
    bloom = [{"level": lvl, "v": bloom_map.get(lvl, 0)} for lvl in bloom_levels]

    # Last 6 months trend
    now = datetime.now(timezone.utc)
    month_keys: list[str] = []
    y, m = now.year, now.month
    for i in range(5, -1, -1):
        mm = m - i
        yy = y
        while mm <= 0:
            mm += 12
            yy -= 1
        month_keys.append(f"{yy:04d}-{mm:02d}")

    paper_month_rows = await db.execute(
        select(func.strftime("%Y-%m", Paper.created_at), func.count(Paper.id))
        .where(Paper.user_id == current_user.id)
        .group_by(func.strftime("%Y-%m", Paper.created_at))
    )
    q_month_rows = await db.execute(
        select(func.strftime("%Y-%m", Question.created_at), func.count(Question.id))
        .select_from(Question)
        .join(Section, Section.id == Question.section_id)
        .join(Paper, Paper.id == Section.paper_id)
        .where(Paper.user_id == current_user.id)
        .group_by(func.strftime("%Y-%m", Question.created_at))
    )
    paper_month_map = {k: v for k, v in paper_month_rows.all() if k}
    q_month_map = {k: v for k, v in q_month_rows.all() if k}
    monthly = [
        {
            "m": datetime.strptime(k, "%Y-%m").strftime("%b"),
            "papers": paper_month_map.get(k, 0),
            "questions": q_month_map.get(k, 0),
        }
        for k in month_keys
    ]

    return {
        "papers_total": papers_total,
        "completed_papers": completed_papers,
        "active_subjects": active_subjects,
        "total_questions": total_questions,
        "question_bank_total": question_bank_total,
        "monthly": monthly,
        "by_subject": by_subject,
        "difficulty": difficulty,
        "bloom": bloom,
    }


# ── Helpers ──────────────────────────────────────────────────

async def _get_owned_paper(paper_id: str, user_id: str, db: AsyncSession) -> Paper:
    result = await db.execute(
        select(Paper).where(Paper.id == paper_id, Paper.user_id == user_id)
    )
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")
    return paper


async def _sync_complete_paper_questions_to_bank(paper_id: str, user_id: str, db: AsyncSession) -> int:
    """Copy all questions from a complete paper into question bank (idempotent)."""
    res = await db.execute(
        select(Question)
        .join(Section, Section.id == Question.section_id)
        .join(Paper, Paper.id == Section.paper_id)
        .where(Paper.id == paper_id, Paper.user_id == user_id)
    )
    questions = res.scalars().all()

    added = 0
    for q in questions:
        if not q.text or not q.text.strip():
            continue

        exists_res = await db.execute(
            select(QuestionBankEntry.id).where(
                QuestionBankEntry.created_by == user_id,
                QuestionBankEntry.topic == q.topic,
                QuestionBankEntry.q_type == q.q_type,
                QuestionBankEntry.marks == q.marks,
                QuestionBankEntry.text == q.text,
            )
        )
        if exists_res.scalar_one_or_none():
            continue

        db.add(
            QuestionBankEntry(
                id=str(uuid.uuid4()),
                created_by=user_id,
                topic=q.topic,
                q_type=q.q_type,
                difficulty=q.difficulty,
                bloom=q.bloom,
                marks=q.marks,
                text=q.text,
                options=q.options,
                answer=q.answer,
                is_ai_generated=True,
                usage_count=0,
            )
        )
        added += 1

    return added
