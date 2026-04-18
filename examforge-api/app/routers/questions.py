import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.paper import Paper
from app.models.question import Question
from app.models.section import Section
from app.models.user import User
from app.schemas.section import (
    QuestionCreate,
    QuestionDifficultyFeedbackIn,
    QuestionOut,
    QuestionUpdate,
)

router = APIRouter(prefix="/sections", tags=["Questions"])

FEEDBACK_TO_SCORE = {
    "too easy": 1,
    "easy": 2,
    "just right": 3,
    "hard": 4,
    "too hard": 5,
}


def _difficulty_label_from_score(score: float) -> str:
    if score <= 1.5:
        return "Easy"
    if score <= 3.5:
        return "Medium"
    if score <= 4.5:
        return "Hard"
    return "Very Hard"


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


async def _question_by_id(question_id: str, db: AsyncSession) -> Question:
    result = await db.execute(select(Question).where(Question.id == question_id))
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


@router.patch("/questions/{question_id}/difficulty-feedback", response_model=QuestionOut)
async def submit_difficulty_feedback(
    question_id: str,
    body: QuestionDifficultyFeedbackIn,
    db: AsyncSession = Depends(get_db),
):
    question = await _question_by_id(question_id, db)

    feedback_key = body.feedback.strip().lower()
    score = FEEDBACK_TO_SCORE.get(feedback_key)
    if score is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid feedback. Use one of: Too Easy, Easy, Just Right, Hard, Too Hard.",
        )

    old_score = max(1, min(5, int(question.difficulty_score or 3)))
    old_count = max(0, int(question.feedback_count or 0))
    averaged_score = ((old_score * old_count) + score) / (old_count + 1)
    updated_score = int(round(averaged_score))
    updated_score = max(1, min(5, updated_score))

    question.difficulty_score = updated_score
    question.feedback_count = old_count + 1
    question.difficulty = _difficulty_label_from_score(averaged_score)

    await db.commit()
    await db.refresh(question)
    return question
