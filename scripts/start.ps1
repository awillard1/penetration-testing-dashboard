# =============================================================================
# Penetration Testing Dashboard — Windows PowerShell start script
# =============================================================================
#Requires -Version 5.1
[CmdletBinding()]param()
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir   = Split-Path -Parent $ScriptDir
Set-Location $RootDir

function Write-Info  { param($msg) Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Write-Ok    { param($msg) Write-Host "[OK]    $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Write-Err   { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red; exit 1 }

# ── Python check ─────────────────────────────────────────────────────────────
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { Write-Err "python not found. Install Python 3.11+ and add to PATH." }
$PyVer = python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
Write-Info "Python $PyVer detected"

# ── Virtual environment ───────────────────────────────────────────────────────
if (-not (Test-Path ".venv")) {
    Write-Info "Creating virtual environment…"
    python -m venv .venv
}
.\.venv\Scripts\Activate.ps1
Write-Ok "Virtual environment active"

# ── Python dependencies ───────────────────────────────────────────────────────
Write-Info "Installing/updating Python dependencies…"
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
Write-Ok "Python dependencies installed"

# ── Frontend build ────────────────────────────────────────────────────────────
if (-not (Test-Path "frontend\dist")) {
    Write-Info "Building frontend…"
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Err "Node.js not found. Install Node.js 18+ and add to PATH." }
    Push-Location frontend
    npm install --silent
    npm run build
    Pop-Location
    Write-Ok "Frontend built"
} else {
    Write-Ok "Frontend dist already exists (run 'cd frontend; npm run build' to rebuild)"
}

# ── Data directories ──────────────────────────────────────────────────────────
@("data\db","data\backups","data\uploads","data\reports","data\exports","data\logs") | ForEach-Object {
    New-Item -ItemType Directory -Force -Path $_ | Out-Null
}
Write-Ok "Data directories ready"

# ── .env file ─────────────────────────────────────────────────────────────────
if (-not (Test-Path ".env")) {
    Write-Warn ".env not found, copying from .env.example"
    Copy-Item .env.example .env
}

# ── Launch ────────────────────────────────────────────────────────────────────
Write-Info "Starting server on http://0.0.0.0:8765"
Write-Host ""
Write-Host "  Dashboard: http://localhost:8765" -ForegroundColor Green
Write-Host ""
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8765
