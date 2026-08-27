"""Backend tests."""
from __future__ import annotations

import asyncio
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import backend.app.models  # noqa – register all models
from backend.app.database import get_session
from backend.app.main import app
from backend.app.config import settings
from backend.app.models.base import Base

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


@pytest.mark.asyncio
async def test_operator_workspace_and_methodology(client: AsyncClient):
    eng = await client.post("/api/v1/engagements", json={"name": "Workspace Eng"})
    eng_id = eng.json()["id"]
    tgt = await client.post(
        "/api/v1/targets",
        json={"engagement_id": eng_id, "hostname": "api.example.com", "url": "https://api.example.com"},
    )
    target_id = tgt.json()["id"]

    seeded = await client.post("/api/v1/operator/methodology/seed")
    assert seeded.status_code == 200
    profiles = await client.get("/api/v1/operator/methodology/profiles")
    assert profiles.status_code == 200
    profile_list = profiles.json()
    assert len(profile_list) > 0
    first_profile = profile_list[0]
    first_item = first_profile["items"][0]

    upsert = await client.put(
        "/api/v1/operator/methodology/results",
        json={
            "engagement_id": eng_id,
            "target_id": target_id,
            "profile_id": first_profile["id"],
            "item_id": first_item["id"],
            "status": "testing",
        },
    )
    assert upsert.status_code == 200

    ws = await client.get(f"/api/v1/operator/workspace?engagement_id={eng_id}&target_id={target_id}")
    assert ws.status_code == 200
    body = ws.json()
    assert body["target"]["id"] == target_id
    assert "coverage" in body
    assert body["coverage"]["status_counts"]["testing"] >= 1


@pytest.mark.asyncio
async def test_operator_command_runner(client: AsyncClient):
    eng = await client.post("/api/v1/engagements", json={"name": "Cmd Eng"})
    eng_id = eng.json()["id"]
    await client.post("/api/v1/scope", json={"engagement_id": eng_id, "item_type": "domain", "value": "example.com"})
    tgt = await client.post(
        "/api/v1/targets",
        json={"engagement_id": eng_id, "hostname": "example.com", "url": "https://example.com"},
    )
    target_id = tgt.json()["id"]

    preview = await client.post(
        "/api/v1/operator/command-runs/preview",
        json={
            "engagement_id": eng_id,
            "target_id": target_id,
            "command_text": "echo operator-test",
            "execution_profile": "linux",
        },
    )
    assert preview.status_code == 200
    assert "command_preview" in preview.json()

    execute = await client.post(
        "/api/v1/operator/command-runs/execute",
        json={
            "engagement_id": eng_id,
            "target_id": target_id,
            "command_text": "echo operator-test",
            "execution_profile": "linux",
            "explicit_confirmation": True,
        },
    )
    assert execute.status_code == 200
    run_id = execute.json()["id"]

    await asyncio.sleep(0.05)
    runs = await client.get(f"/api/v1/operator/command-runs?engagement_id={eng_id}")
    assert runs.status_code == 200
    run = next((r for r in runs.json() if r["id"] == run_id), None)
    assert run is not None
    assert run["status"] in {"queued", "running", "completed", "failed", "stopped"}


@pytest.mark.asyncio
async def test_evidence_upload_detail_preview_and_download(client: AsyncClient, tmp_path: Path):
    settings.attachment_dir = tmp_path / "attachments"
    settings.attachment_dir.mkdir(parents=True, exist_ok=True)

    er = await client.post("/api/v1/engagements", json={"name": "Evidence Eng"})
    eng_id = er.json()["id"]

    files = {"file": ("request.json", b'{\"hello\":\"world\"}', "application/json")}
    upload = await client.post(
        f"/api/v1/evidence/upload?engagement_id={eng_id}&title=RequestEvidence&evidence_type=http_request",
        files=files,
    )
    assert upload.status_code == 201
    evidence_id = upload.json()["id"]

    detail = await client.get(f"/api/v1/evidence/{evidence_id}/detail")
    assert detail.status_code == 200
    detail_body = detail.json()
    assert detail_body["file_exists"] is True
    assert detail_body["preview_kind"] == "text"
    assert detail_body["sha256"]

    preview = await client.get(f"/api/v1/evidence/{evidence_id}/preview")
    assert preview.status_code == 200
    assert preview.json()["preview_kind"] == "text"
    assert "hello" in preview.json()["raw"]

    ranged = await client.get(f"/api/v1/evidence/{evidence_id}/file", headers={"Range": "bytes=0-4"})
    assert ranged.status_code == 206
    assert ranged.headers["accept-ranges"] == "bytes"
    assert ranged.content == b"{\"hel"


@pytest.mark.asyncio
async def test_evidence_path_traversal_protection(client: AsyncClient):
    er = await client.post("/api/v1/engagements", json={"name": "Traversal Eng"})
    eng_id = er.json()["id"]
    created = await client.post(
        "/api/v1/evidence",
        json={
            "engagement_id": eng_id,
            "title": "Bad path",
            "evidence_type": "file",
            "file_path": "/etc/passwd",
        },
    )
    assert created.status_code == 201
    evidence_id = created.json()["id"]

    blocked = await client.get(f"/api/v1/evidence/{evidence_id}/file")
    assert blocked.status_code in {403, 404}


@pytest.mark.asyncio
async def test_evidence_finding_association_attach_detach(client: AsyncClient):
    er = await client.post("/api/v1/engagements", json={"name": "Association Eng"})
    eng_id = er.json()["id"]
    finding = await client.post(
        "/api/v1/findings",
        json={"engagement_id": eng_id, "title": "Attach Target", "severity": "medium", "status": "draft"},
    )
    finding_id = finding.json()["id"]

    evidence = await client.post(
        "/api/v1/evidence",
        json={"engagement_id": eng_id, "title": "Attachable", "evidence_type": "other"},
    )
    evidence_id = evidence.json()["id"]

    attach = await client.post(f"/api/v1/evidence/{evidence_id}/findings/{finding_id}")
    assert attach.status_code == 201

    detail = await client.get(f"/api/v1/evidence/{evidence_id}/detail")
    assert detail.status_code == 200
    assert finding_id in detail.json()["finding_ids"]

    detach = await client.delete(f"/api/v1/evidence/{evidence_id}/findings/{finding_id}")
    assert detach.status_code == 204

    detail_after = await client.get(f"/api/v1/evidence/{evidence_id}/detail")
    assert finding_id not in detail_after.json()["finding_ids"]
