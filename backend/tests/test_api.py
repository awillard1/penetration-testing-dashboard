"""Backend tests."""
from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from backend.app.database import get_session
from backend.app.main import app
from backend.app.models.base import Base
from backend.app.models.user import User
from backend.app.security import hash_password
import backend.app.models  # noqa: F401 – register all models


TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionFactory = async_sessionmaker(engine, expire_on_commit=False)


async def create_user_record(
    session: AsyncSession,
    username: str,
    password: str,
    role: str = "penetration_tester",
    client_id: str | None = None,
) -> User:
    user = User(
        username=username,
        hashed_password=hash_password(password),
        role=role,
        client_id=client_id,
        auth_provider="local",
        is_active=True,
    )
    session.add(user)
    await session.flush()
    await session.refresh(user)
    return user


async def auth_headers(
    api_client: AsyncClient,
    username: str,
    password: str,
) -> dict[str, str]:
    response = await api_client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": "Bearer " + token}


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
async def public_client(db_session: AsyncSession):
    async def override_session():
        yield db_session

    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(public_client: AsyncClient, db_session: AsyncSession):
    await create_user_record(
        db_session,
        "tester",
        "tester-pass",
        role="penetration_tester",
    )
    public_client.headers.update(await auth_headers(public_client, "tester", "tester-pass"))
    yield public_client
    public_client.headers.clear()


@pytest.mark.asyncio
async def test_health(public_client: AsyncClient):
    r = await public_client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_docs_redirect_alias(public_client: AsyncClient):
    r = await public_client.get("/docs", follow_redirects=False)
    assert r.status_code in {302, 307}
    assert r.headers["location"] == "/api/docs"


@pytest.mark.asyncio
async def test_protected_route_requires_bearer_token(public_client: AsyncClient):
    r = await public_client.get("/api/v1/clients")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_login_and_refresh(public_client: AsyncClient, db_session: AsyncSession):
    await create_user_record(
        db_session,
        "admin",
        "admin-pass",
        role="admin",
    )

    login_response = await public_client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin-pass"},
    )
    assert login_response.status_code == 200
    login_data = login_response.json()
    assert login_data["token_type"] == "bearer"
    assert login_data["user"]["role"] == "admin"

    refresh_response = await public_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": login_data["refresh_token"]},
    )
    assert refresh_response.status_code == 200
    refresh_data = refresh_response.json()
    assert refresh_data["access_token"] != login_data["access_token"]
    assert refresh_data["refresh_token"] != login_data["refresh_token"]


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
async def test_client_role_has_read_only_access_to_own_findings(
    client: AsyncClient,
    public_client: AsyncClient,
    db_session: AsyncSession,
):
    create_client_response = await client.post("/api/v1/clients", json={"name": "Scoped Client"})
    client_id = create_client_response.json()["id"]
    engagement_response = await client.post(
        "/api/v1/engagements",
        json={"name": "Client Engagement", "client_id": client_id},
    )
    engagement_id = engagement_response.json()["id"]
    finding_response = await client.post(
        "/api/v1/findings",
        json={"engagement_id": engagement_id, "title": "Scoped Finding", "severity": "medium"},
    )
    finding_id = finding_response.json()["id"]

    await create_user_record(
        db_session,
        "client-user",
        "client-pass",
        role="client",
        client_id=client_id,
    )
    client_headers = await auth_headers(public_client, "client-user", "client-pass")

    list_response = await public_client.get("/api/v1/findings", headers=client_headers)
    assert list_response.status_code == 200
    assert [finding["id"] for finding in list_response.json()] == [finding_id]

    get_response = await public_client.get(
        f"/api/v1/findings/{finding_id}",
        headers=client_headers,
    )
    assert get_response.status_code == 200
    assert get_response.json()["internal_notes"] is None

    create_response = await public_client.post(
        "/api/v1/findings",
        headers=client_headers,
        json={"engagement_id": engagement_id, "title": "Blocked", "severity": "low"},
    )
    assert create_response.status_code == 403

    client_resource_response = await public_client.get("/api/v1/clients", headers=client_headers)
    assert client_resource_response.status_code == 403


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
    assert "s3cret" not in str(data)
    assert "encrypted_secret" not in data


@pytest.mark.asyncio
async def test_global_search(client: AsyncClient):
    await client.post("/api/v1/engagements", json={"name": "SearchableEngagement"})
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
