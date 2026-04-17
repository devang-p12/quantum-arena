"""
Question Bank CRUD Router
GET  /bank          — list with filters
POST /bank          — add a question
GET  /bank/:id      — get one
PATCH /bank/:id     — update
DELETE /bank/:id    — remove
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.question_bank import QuestionBankEntry
from app.models.user import User
from app.schemas.question_bank import QuestionBankCreate, QuestionBankOut, QuestionBankUpdate

router = APIRouter(prefix="/bank", tags=["Question Bank"])


@router.get("", response_model=list[QuestionBankOut])
async def list_bank(
    topic: Optional[str] = Query(None),
    q_type: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    bloom: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(QuestionBankEntry)
    if topic:
        q = q.where(QuestionBankEntry.topic.ilike(f"%{topic}%"))
    if q_type:
        q = q.where(QuestionBankEntry.q_type == q_type)
    if difficulty:
        q = q.where(QuestionBankEntry.difficulty == difficulty)
    if bloom:
        q = q.where(QuestionBankEntry.bloom == bloom)
    q = q.order_by(QuestionBankEntry.usage_count.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=QuestionBankOut, status_code=status.HTTP_201_CREATED)
async def add_to_bank(
    body: QuestionBankCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = QuestionBankEntry(
        id=str(uuid.uuid4()),
        created_by=current_user.id,
        **body.model_dump(),
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.get("/{entry_id}", response_model=QuestionBankOut)
async def get_bank_entry(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = await _get_entry(entry_id, db)
    return entry


@router.patch("/{entry_id}", response_model=QuestionBankOut)
async def update_bank_entry(
    entry_id: str,
    body: QuestionBankUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = await _get_entry(entry_id, db)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(entry, k, v)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bank_entry(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = await _get_entry(entry_id, db)
    await db.delete(entry)
    await db.commit()


# ── Helper ──────────────────────────────────────────────────

async def _get_entry(entry_id: str, db: AsyncSession) -> QuestionBankEntry:
    res = await db.execute(select(QuestionBankEntry).where(QuestionBankEntry.id == entry_id))
    entry = res.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Question bank entry not found.")
    return entry
