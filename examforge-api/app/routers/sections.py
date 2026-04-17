import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models.paper import Paper
from app.models.section import Section
from app.models.user import User
from app.schemas.section import SectionCreate, SectionOut, SectionReorder, SectionUpdate

router = APIRouter(prefix="/papers", tags=["Sections"])


# ── Helpers ──────────────────────────────────────────────────

async def _owned_paper(paper_id: str, user_id: str, db: AsyncSession) -> Paper:
    result = await db.execute(select(Paper).where(Paper.id == paper_id, Paper.user_id == user_id))
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")
    return paper


async def _owned_section(section_id: str, user_id: str, db: AsyncSession) -> Section:
    result = await db.execute(
        select(Section)
        .options(selectinload(Section.questions))
        .join(Paper, Paper.id == Section.paper_id)
        .where(Section.id == section_id, Paper.user_id == user_id)
    )
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found.")
    return section


# ── Endpoints ────────────────────────────────────────────────

@router.get("/{paper_id}/sections", response_model=list[SectionOut])
async def list_sections(
    paper_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _owned_paper(paper_id, current_user.id, db)
    result = await db.execute(
        select(Section)
        .options(selectinload(Section.questions))
        .where(Section.paper_id == paper_id)
        .order_by(Section.order_index)
    )
    return result.scalars().all()


@router.post("/{paper_id}/sections", response_model=SectionOut, status_code=status.HTTP_201_CREATED)
async def create_section(
    paper_id: str,
    body: SectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _owned_paper(paper_id, current_user.id, db)
    section = Section(id=str(uuid.uuid4()), paper_id=paper_id, **body.model_dump())
    db.add(section)
    await db.commit()
    # Re-fetch with questions loaded
    result = await db.execute(
        select(Section).options(selectinload(Section.questions)).where(Section.id == section.id)
    )
    return result.scalar_one()


@router.patch("/sections/{section_id}", response_model=SectionOut)
async def update_section(
    section_id: str,
    body: SectionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    section = await _owned_section(section_id, current_user.id, db)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(section, k, v)
    await db.commit()
    result = await db.execute(
        select(Section).options(selectinload(Section.questions)).where(Section.id == section_id)
    )
    return result.scalar_one()


@router.delete("/sections/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_section(
    section_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    section = await _owned_section(section_id, current_user.id, db)
    await db.delete(section)
    await db.commit()


@router.put("/sections/{section_id}/reorder", response_model=list[SectionOut])
async def reorder_sections(
    section_id: str,
    body: SectionReorder,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk-reorder all sections in a paper. section_id is used for auth check (must belong to user)."""
    section = await _owned_section(section_id, current_user.id, db)
    for item in body.items:
        res = await db.execute(select(Section).where(Section.id == item["id"]))
        sec = res.scalar_one_or_none()
        if sec:
            sec.order_index = item["order_index"]
    await db.commit()
    result = await db.execute(
        select(Section)
        .options(selectinload(Section.questions))
        .where(Section.paper_id == section.paper_id)
        .order_by(Section.order_index)
    )
    return result.scalars().all()
