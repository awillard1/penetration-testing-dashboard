"""Backend tests."""
from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.database import get_session
from backend.app.models.base import Base
import backend.app.models  # noqa – register all models


TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionFactory = async_sessionmaker(engine, expire_on_commit=False)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session():
    async with TestSessionFactory() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    async def override_session():
        yield db_session

    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    r = await client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_create_and_list_clients(client: AsyncClient):
    r = await client.post("/api/v1/clients", json={"name": "Test Client"})
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Test Client"
    client_id = data["id"]

    r2 = await client.get("/api/v1/clients")
    assert r2.status_code == 200
    assert any(c["id"] == client_id for c in r2.json())


@pytest.mark.asyncio
async def test_create_engagement(client: AsyncClient):
    r = await client.post(
        "/api/v1/engagements",
        json={"name": "Test Engagement", "engagement_type": "web_application", "status": "active"},
    )
    assert r.status_code == 201
    assert r.json()["name"] == "Test Engagement"


@pytest.mark.asyncio
async def test_create_finding(client: AsyncClient):
    # Create engagement first
    er = await client.post("/api/v1/engagements", json={"name": "Finding Test Eng"})
    eng_id = er.json()["id"]

    r = await client.post(
        "/api/v1/findings",
        json={"engagement_id": eng_id, "title": "Test Finding", "severity": "high", "status": "draft"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["title"] == "Test Finding"
    assert data["severity"] == "high"


@pytest.mark.asyncio
async def test_create_target(client: AsyncClient):
    er = await client.post("/api/v1/engagements", json={"name": "Target Test Eng"})
    eng_id = er.json()["id"]

    r = await client.post(
        "/api/v1/targets",
        json={"engagement_id": eng_id, "hostname": "test.example.com", "ip_address": "192.168.1.1"},
    )
    assert r.status_code == 201
    assert r.json()["hostname"] == "test.example.com"


@pytest.mark.asyncio
async def test_create_task(client: AsyncClient):
    er = await client.post("/api/v1/engagements", json={"name": "Task Test Eng"})
    eng_id = er.json()["id"]

    r = await client.post(
        "/api/v1/tasks",
        json={"engagement_id": eng_id, "title": "Test Task", "status": "backlog"},
    )
    assert r.status_code == 201
    assert r.json()["title"] == "Test Task"


@pytest.mark.asyncio
async def test_create_link(client: AsyncClient):
    r = await client.post(
        "/api/v1/links",
        json={"name": "OWASP", "url": "https://owasp.org", "category": "vulnerability_research"},
    )
    assert r.status_code == 201
    assert r.json()["name"] == "OWASP"


@pytest.mark.asyncio
async def test_credential_encryption(client: AsyncClient):
    er = await client.post("/api/v1/engagements", json={"name": "Cred Test Eng"})
    eng_id = er.json()["id"]

    r = await client.post(
        "/api/v1/credentials",
        json={"engagement_id": eng_id, "username": "admin", "secret_type": "password", "plaintext_secret": "s3cret"},
    )
    assert r.status_code == 201
    data = r.json()
    # Secret must never be returned in the response
    assert "s3cret" not in str(data)
    assert "encrypted_secret" not in data


@pytest.mark.asyncio
async def test_global_search(client: AsyncClient):
    er = await client.post("/api/v1/engagements", json={"name": "SearchableEngagement"})
    r = await client.get("/api/v1/search?q=Searchable")
    assert r.status_code == 200
    results = r.json()
    assert any(item["entity_type"] == "engagement" for item in results)


@pytest.mark.asyncio
async def test_note_crud(client: AsyncClient):
    er = await client.post("/api/v1/engagements", json={"name": "Note Test Eng"})
    eng_id = er.json()["id"]

    r = await client.post("/api/v1/notes", json={"engagement_id": eng_id, "title": "Day 1", "content": "## Notes"})
    assert r.status_code == 201
    note_id = r.json()["id"]

    r2 = await client.patch(f"/api/v1/notes/{note_id}", json={"title": "Day 1 Updated"})
    assert r2.status_code == 200
    assert r2.json()["title"] == "Day 1 Updated"

    r3 = await client.delete(f"/api/v1/notes/{note_id}")
    assert r3.status_code == 204


@pytest.mark.asyncio
async def test_scope_item(client: AsyncClient):
    er = await client.post("/api/v1/engagements", json={"name": "Scope Test Eng"})
    eng_id = er.json()["id"]

    r = await client.post("/api/v1/scope", json={"engagement_id": eng_id, "item_type": "domain", "value": "example.com"})
    assert r.status_code == 201
    assert r.json()["value"] == "example.com"
