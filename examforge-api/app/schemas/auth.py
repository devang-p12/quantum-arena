from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


# ── Request bodies ──────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Optional[str] = "Professor"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ── Response bodies ─────────────────────────────────────────
class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut
