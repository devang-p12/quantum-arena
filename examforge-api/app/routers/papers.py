import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, File, Form, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.paper import Paper
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


@router.get("/{paper_id}", response_model=PaperOut)
async def get_paper(
    paper_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    paper = await _get_owned_paper(paper_id, current_user.id, db)
    return paper


@router.patch("/{paper_id}", response_model=PaperOut)
async def update_paper(
    paper_id: str,
    body: PaperUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    paper = await _get_owned_paper(paper_id, current_user.id, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(paper, field, value)
    await db.commit()
    await db.refresh(paper)
    return paper


@router.delete("/{paper_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_paper(
    paper_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    paper = await _get_owned_paper(paper_id, current_user.id, db)
    await db.delete(paper)
    await db.commit()


@router.post("/parse-pattern")
async def parse_pattern(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
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
        blueprint = await parse_blueprint_to_json(raw_text)
        return blueprint
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Parsing failed: {str(e)}")


# ── Helpers ──────────────────────────────────────────────────

async def _get_owned_paper(paper_id: str, user_id: str, db: AsyncSession) -> Paper:
    result = await db.execute(
        select(Paper).where(Paper.id == paper_id, Paper.user_id == user_id)
    )
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")
    return paper
