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
from backend.app.models.operator import AssetEndpoint, AssetHost, AssetService, AssetUrl, EndpointParameter
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
async def test_api_root_redirect_aliases(public_client: AsyncClient):
    for path in ("/api", "/api/", "/api/v1", "/api/v1/"):
        r = await public_client.get(path, follow_redirects=False)
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


async def seed_operator_regression_fixture(client: AsyncClient, db_session: AsyncSession) -> dict[str, str]:
    engagement_response = await client.post(
        "/api/v1/engagements",
        json={"name": "Operator Regression Engagement", "engagement_type": "web_application", "status": "active"},
    )
    assert engagement_response.status_code == 201
    engagement_id = engagement_response.json()["id"]

    target_response = await client.post(
        "/api/v1/targets",
        json={
            "engagement_id": engagement_id,
            "hostname": "target.example.com",
            "ip_address": "10.10.10.10",
            "url": "https://target.example.com",
        },
    )
    assert target_response.status_code == 201
    target_id = target_response.json()["id"]

    host = AssetHost(
        engagement_id=engagement_id,
        target_id=target_id,
        hostname="target.example.com",
        ip_address="10.10.10.10",
        source_tool="seed",
    )
    db_session.add(host)
    await db_session.flush()

    service = AssetService(
        engagement_id=engagement_id,
        host_id=host.id,
        port=443,
        protocol="tcp",
        service_name="https",
        source_tool="seed",
    )
    db_session.add(service)
    await db_session.flush()

    asset_url = AssetUrl(
        engagement_id=engagement_id,
        host_id=host.id,
        service_id=service.id,
        url="https://target.example.com",
        source_tool="seed",
    )
    db_session.add(asset_url)
    await db_session.flush()

    endpoint = AssetEndpoint(
        engagement_id=engagement_id,
        target_id=target_id,
        host_id=host.id,
        service_id=service.id,
        url_id=asset_url.id,
        method="GET",
        path="/login",
        auth_requirement="session",
        source_tool="seed",
    )
    db_session.add(endpoint)
    await db_session.flush()

    db_session.add(
        EndpointParameter(
            endpoint_id=endpoint.id,
            location="query",
            name="redirect",
            sample_value="/dashboard",
            source_tool="seed",
        )
    )
    await db_session.flush()

    finding_response = await client.post(
        "/api/v1/findings",
        json={
            "engagement_id": engagement_id,
            "title": "Login Weakness",
            "severity": "medium",
            "status": "draft",
            "affected_endpoints": "/login",
        },
    )
    assert finding_response.status_code == 201
    finding_id = finding_response.json()["id"]

    credential_response = await client.post(
        "/api/v1/credentials",
        json={
            "engagement_id": engagement_id,
            "target_id": target_id,
            "username": "operator",
            "secret_type": "password",
            "plaintext_secret": "operator-secret",
        },
    )
    assert credential_response.status_code == 201
    credential_id = credential_response.json()["id"]

    evidence_response = await client.post(
        f"/api/v1/evidence/upload?engagement_id={engagement_id}&title=Proxy%20Capture&evidence_type=http_request",
        files={"file": ("capture.txt", b"GET /login HTTP/1.1\nHost: target.example.com\n", "text/plain")},
    )
    assert evidence_response.status_code == 201
    evidence_id = evidence_response.json()["id"]

    scan_response = await client.post(
        f"/api/v1/scans/upload?engagement_id={engagement_id}",
        files={"file": ("scan.xml", b"<nmaprun></nmaprun>", "application/xml")},
    )
    assert scan_response.status_code == 201
    scan_id = scan_response.json()["id"]

    return {
        "engagement_id": engagement_id,
        "target_id": target_id,
        "finding_id": finding_id,
        "credential_id": credential_id,
        "evidence_id": evidence_id,
        "scan_id": scan_id,
        "endpoint_id": endpoint.id,
    }


@pytest.mark.asyncio
async def test_operator_can_access_restored_expand_endpoints(client: AsyncClient, db_session: AsyncSession):
    ids = await seed_operator_regression_fixture(client, db_session)

    profiles_response = await client.get("/api/v1/operator/methodology/profiles")
    assert profiles_response.status_code == 200
    profiles = profiles_response.json()
    assert profiles and profiles[0]["items"]

    methodology_response = await client.put(
        "/api/v1/operator/methodology/results",
        json={
            "engagement_id": ids["engagement_id"],
            "target_id": ids["target_id"],
            "profile_id": profiles[0]["id"],
            "item_id": profiles[0]["items"][0]["id"],
            "status": "testing",
            "finding_id": ids["finding_id"],
            "evidence_id": ids["evidence_id"],
        },
    )
    assert methodology_response.status_code == 200

    workspace_response = await client.get(
        f"/api/v1/operator/workspace?engagement_id={ids['engagement_id']}&target_id={ids['target_id']}"
    )
    assert workspace_response.status_code == 200

    endpoint_detail_response = await client.get(f"/api/v1/operator/endpoints/{ids['endpoint_id']}/detail")
    assert endpoint_detail_response.status_code == 200

    update_endpoint_response = await client.patch(
        f"/api/v1/operator/endpoints/{ids['endpoint_id']}",
        json={"testing_status": "testing", "auth_requirement": "token", "interesting": True, "notes": "Review in progress"},
    )
    assert update_endpoint_response.status_code == 200

    http_messages_response = await client.get(
        f"/api/v1/operator/http-messages?engagement_id={ids['engagement_id']}&target_id={ids['target_id']}"
    )
    assert http_messages_response.status_code == 200

    preview_response = await client.post(
        "/api/v1/operator/command-runs/preview",
        json={
            "engagement_id": ids["engagement_id"],
            "target_id": ids["target_id"],
            "command_text": "echo hello",
            "execution_profile": "linux",
            "working_directory": "repo",
        },
    )
    assert preview_response.status_code == 200

    execute_response = await client.post(
        "/api/v1/operator/command-runs/execute",
        json={
            "engagement_id": ids["engagement_id"],
            "target_id": ids["target_id"],
            "command_text": "echo hello",
            "execution_profile": "linux",
            "working_directory": "repo",
            "explicit_confirmation": True,
        },
    )
    assert execute_response.status_code == 200
    run_id = execute_response.json()["id"]

    runs_response = await client.get(f"/api/v1/operator/command-runs?engagement_id={ids['engagement_id']}")
    assert runs_response.status_code == 200
    assert any(row["id"] == run_id for row in runs_response.json())

    stop_response = await client.post(f"/api/v1/operator/command-runs/{run_id}/stop")
    assert stop_response.status_code == 200

    burp_response = await client.post(
        "/api/v1/operator/integrations/burp/ingest",
        json={
            "engagement_id": ids["engagement_id"],
            "target_id": ids["target_id"],
            "url": "https://target.example.com/admin",
            "method": "GET",
            "status_code": 200,
            "request_raw": "GET /admin HTTP/1.1\nHost: target.example.com\n",
            "response_raw": "HTTP/1.1 200 OK\n\nadmin",
        },
    )
    assert burp_response.status_code == 200

    recon_response = await client.get(
        f"/api/v1/operator/recon?engagement_id={ids['engagement_id']}&target_id={ids['target_id']}"
    )
    assert recon_response.status_code == 200

    snapshot_response = await client.post(
        "/api/v1/operator/recon/snapshots",
        json={"engagement_id": ids["engagement_id"], "target_id": ids["target_id"], "label": "baseline"},
    )
    assert snapshot_response.status_code == 201
    snapshot_id = snapshot_response.json()["id"]

    snapshots_response = await client.get(
        f"/api/v1/operator/recon/snapshots?engagement_id={ids['engagement_id']}&target_id={ids['target_id']}"
    )
    assert snapshots_response.status_code == 200
    assert any(row["id"] == snapshot_id for row in snapshots_response.json())

    diff_response = await client.get(
        f"/api/v1/operator/recon/diff?base_snapshot_id={snapshot_id}&compare_snapshot_id={snapshot_id}"
    )
    assert diff_response.status_code == 200

    jobs_response = await client.get(f"/api/v1/operator/jobs?engagement_id={ids['engagement_id']}")
    assert jobs_response.status_code == 200

    add_annotation_response = await client.post(
        f"/api/v1/operator/evidence/{ids['evidence_id']}/annotations",
        json={"annotation_json": "{}", "caption": "highlight", "display_order": 1},
    )
    assert add_annotation_response.status_code == 200

    list_annotations_response = await client.get(f"/api/v1/operator/evidence/{ids['evidence_id']}/annotations")
    assert list_annotations_response.status_code == 200
    assert len(list_annotations_response.json()) == 1

    add_usage_response = await client.post(
        f"/api/v1/operator/credentials/{ids['credential_id']}/usages",
        json={
            "engagement_id": ids["engagement_id"],
            "target_id": ids["target_id"],
            "endpoint_id": ids["endpoint_id"],
            "validation_state": "valid",
        },
    )
    assert add_usage_response.status_code == 200

    usage_list_response = await client.get(f"/api/v1/operator/credentials/{ids['credential_id']}/usages")
    assert usage_list_response.status_code == 200
    assert len(usage_list_response.json()) == 1

    checklist_response = await client.get(f"/api/v1/operator/checklists?engagement_id={ids['engagement_id']}")
    assert checklist_response.status_code == 200

    foothold_response = await client.get(f"/api/v1/operator/footholds?engagement_id={ids['engagement_id']}")
    assert foothold_response.status_code == 200

    evidence_detail_response = await client.get(f"/api/v1/evidence/{ids['evidence_id']}/detail")
    assert evidence_detail_response.status_code == 200

    evidence_preview_response = await client.get(f"/api/v1/evidence/{ids['evidence_id']}/preview")
    assert evidence_preview_response.status_code == 200

    evidence_file_response = await client.get(f"/api/v1/evidence/{ids['evidence_id']}/file")
    assert evidence_file_response.status_code == 200

    attach_evidence_response = await client.post(
        f"/api/v1/evidence/{ids['evidence_id']}/findings/{ids['finding_id']}"
    )
    assert attach_evidence_response.status_code == 201

    detach_evidence_response = await client.delete(
        f"/api/v1/evidence/{ids['evidence_id']}/findings/{ids['finding_id']}"
    )
    assert detach_evidence_response.status_code == 204

    scan_get_response = await client.get(f"/api/v1/scans/{ids['scan_id']}")
    assert scan_get_response.status_code == 200

    scan_detail_response = await client.get(f"/api/v1/scans/{ids['scan_id']}/detail")
    assert scan_detail_response.status_code == 200

    scan_update_response = await client.patch(f"/api/v1/scans/{ids['scan_id']}", json={"notes": "Reviewed"})
    assert scan_update_response.status_code == 200

    create_runner_response = await client.post(
        "/api/v1/runners",
        json={"name": "Runner Node", "hostname": "runner.local", "platform": "linux", "architecture": "amd64"},
    )
    assert create_runner_response.status_code == 201
    runner_id = create_runner_response.json()["id"]

    list_runners_response = await client.get("/api/v1/runners")
    assert list_runners_response.status_code == 200
    assert any(row["id"] == runner_id for row in list_runners_response.json())

    update_runner_response = await client.patch(f"/api/v1/runners/{runner_id}", json={"is_enabled": False})
    assert update_runner_response.status_code == 200

    revoke_runner_response = await client.post(f"/api/v1/runners/{runner_id}/revoke")
    assert revoke_runner_response.status_code == 200

    runner_jobs_response = await client.get(f"/api/v1/runners/{runner_id}/jobs")
    assert runner_jobs_response.status_code == 200


@pytest.mark.asyncio
async def test_restored_expand_endpoints_require_authentication(client: AsyncClient, public_client: AsyncClient, db_session: AsyncSession):
    ids = await seed_operator_regression_fixture(client, db_session)
    public_client.headers.clear()
    public_client.cookies.clear()

    requests = [
        ("get", "/api/v1/operator/methodology/profiles", {}),
        ("get", f"/api/v1/operator/workspace?engagement_id={ids['engagement_id']}&target_id={ids['target_id']}", {}),
        ("get", f"/api/v1/evidence/{ids['evidence_id']}/detail", {}),
        ("get", f"/api/v1/scans/{ids['scan_id']}/detail", {}),
        ("get", "/api/v1/runners", {}),
    ]

    for method, url, kwargs in requests:
        response = await getattr(public_client, method)(url, **kwargs)
        assert response.status_code == 401, url


@pytest.mark.asyncio
async def test_restored_expand_endpoints_enforce_staff_role(
    client: AsyncClient,
    public_client: AsyncClient,
    db_session: AsyncSession,
):
    ids = await seed_operator_regression_fixture(client, db_session)

    await create_user_record(db_session, "reviewer-user", "reviewer-pass", role="reviewer")
    reviewer_headers = await auth_headers(public_client, "reviewer-user", "reviewer-pass")

    requests = [
        ("get", "/api/v1/operator/methodology/profiles", {}),
        ("get", f"/api/v1/operator/workspace?engagement_id={ids['engagement_id']}&target_id={ids['target_id']}", {}),
        ("get", f"/api/v1/evidence/{ids['evidence_id']}/detail", {}),
        ("get", f"/api/v1/scans/{ids['scan_id']}/detail", {}),
        ("post", "/api/v1/runners", {"json": {"name": "Forbidden Runner"}}),
    ]

    for method, url, kwargs in requests:
        response = await getattr(public_client, method)(url, headers=reviewer_headers, **kwargs)
        assert response.status_code == 403, url
