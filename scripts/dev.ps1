# Development mode: backend hot-reload + Vite dev server
#Requires -Version 5.1
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir   = Split-Path -Parent $ScriptDir
Set-Location $RootDir

if (Test-Path ".venv") { .\.venv\Scripts\Activate.ps1 }

@("data\db","data\backups","data\uploads","data\reports","data\exports","data\logs") | ForEach-Object { New-Item -ItemType Directory -Force -Path $_ | Out-Null }
if (-not (Test-Path ".env")) { Copy-Item .env.example .env }

Write-Host "[DEV] Starting backend on :8765 (hot-reload)…" -ForegroundColor Cyan
$Backend = Start-Process -PassThru -NoNewWindow python -ArgumentList "-m","uvicorn","backend.app.main:app","--host","127.0.0.1","--port","8765","--reload"

Write-Host "[DEV] Starting Vite dev server on :5173…" -ForegroundColor Cyan
$Frontend = Start-Process -PassThru -NoNewWindow npm -WorkingDirectory frontend -ArgumentList "run","dev"

Write-Host ""
Write-Host "  Backend:  http://localhost:8765" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:5173  (proxies /api to backend)" -ForegroundColor Green
Write-Host ""
Write-Host "  Press Ctrl+C to stop both."
Write-Host ""

try { Wait-Process $Backend.Id, $Frontend.Id }
finally { Stop-Process -Id $Backend.Id, $Frontend.Id -ErrorAction SilentlyContinue }
