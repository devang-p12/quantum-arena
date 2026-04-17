import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.database import Base
from app.dependencies import get_db

TEST_DB_URL = "postgresql+asyncpg://postgres:password@localhost:5432/examforge_test"

test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSession = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session():
    async with TestSession() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_register(client):
    res = await client.post("/auth/register", json={
        "name": "Dr. Test",
        "email": "test@examforge.ai",
        "password": "secret123",
    })
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "test@examforge.ai"


@pytest.mark.asyncio
async def test_register_duplicate(client):
    payload = {"name": "Dup", "email": "dup@examforge.ai", "password": "abc123"}
    await client.post("/auth/register", json=payload)
    res = await client.post("/auth/register", json=payload)
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_login_success(client):
    await client.post("/auth/register", json={
        "name": "Login User", "email": "login@examforge.ai", "password": "pass123"
    })
    res = await client.post("/auth/login", json={
        "email": "login@examforge.ai", "password": "pass123"
    })
    assert res.status_code == 200
    assert "access_token" in res.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    await client.post("/auth/register", json={
        "name": "Bad Pass", "email": "badpass@examforge.ai", "password": "correct"
    })
    res = await client.post("/auth/login", json={
        "email": "badpass@examforge.ai", "password": "wrong"
    })
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_me(client):
    reg = await client.post("/auth/register", json={
        "name": "Me User", "email": "me@examforge.ai", "password": "pass123"
    })
    token = reg.json()["access_token"]
    res = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["email"] == "me@examforge.ai"


@pytest.mark.asyncio
async def test_me_no_token(client):
    res = await client.get("/auth/me")
    assert res.status_code == 403
