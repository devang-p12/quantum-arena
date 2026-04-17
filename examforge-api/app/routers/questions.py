import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.paper import Paper
from app.models.question import Question
from app.models.section import Section
from app.models.user import User
from app.schemas.section import QuestionCreate, QuestionOut, QuestionUpdate

router = APIRouter(prefix="/sections", tags=["Questions"])


# ── Helpers ──────────────────────────────────────────────────

async def _owned_section(section_id: str, user_id: str, db: AsyncSession) -> Section:
    result = await db.execute(
        select(Section)
        .join(Paper, Paper.id == Section.paper_id)
        .where(Section.id == section_id, Paper.user_id == user_id)
    )
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found.")
    return section


async def _owned_question(question_id: str, user_id: str, db: AsyncSession) -> Question:
    result = await db.execute(
        select(Question)
        .join(Section, Section.id == Question.section_id)
        .join(Paper, Paper.id == Section.paper_id)
        .where(Question.id == question_id, Paper.user_id == user_id)
    )
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found.")
    return question


# ── Endpoints ────────────────────────────────────────────────

@router.get("/{section_id}/questions", response_model=list[QuestionOut])
async def list_questions(
    section_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _owned_section(section_id, current_user.id, db)
    result = await db.execute(
        select(Question).where(Question.section_id == section_id).order_by(Question.order_index)
    )
    return result.scalars().all()


@router.post("/{section_id}/questions", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
async def create_question(
    section_id: str,
    body: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _owned_section(section_id, current_user.id, db)
    question = Question(id=str(uuid.uuid4()), section_id=section_id, **body.model_dump())
    db.add(question)
    await db.commit()
    await db.refresh(question)
    return question


@router.patch("/questions/{question_id}", response_model=QuestionOut)
async def update_question(
    question_id: str,
    body: QuestionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    question = await _owned_question(question_id, current_user.id, db)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(question, k, v)
    await db.commit()
    await db.refresh(question)
    return question


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    question = await _owned_question(question_id, current_user.id, db)
    await db.delete(question)
    await db.commit()


@router.patch("/questions/{question_id}/star", response_model=QuestionOut)
async def toggle_star(
    question_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    question = await _owned_question(question_id, current_user.id, db)
    question.starred = not question.starred
    await db.commit()
    await db.refresh(question)
    return question
