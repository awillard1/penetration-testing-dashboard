param(
  [switch]$projectdiscovery,
  [switch]$web,
  [switch]$network,
  [switch]$code,
  [switch]$cracking,
  [switch]$all
)

if (-not ($projectdiscovery -or $web -or $network -or $code -or $cracking -or $all)) {
  Write-Host "Use one of: -projectdiscovery -web -network -code -cracking -all"
  exit 1
}

function Confirm-Step($label) {
  $ans = Read-Host "Install $label group? (y/N)"
  return $ans -match '^[Yy]$'
}

if ($all) {
  $projectdiscovery = $web = $network = $code = $cracking = $true
}

if ($projectdiscovery -and (Confirm-Step "projectdiscovery")) {
  Write-Host "Install Go and ProjectDiscovery tools manually or through WSL package manager for best compatibility."
}
if ($web -and (Confirm-Step "web")) {
  Write-Host "Install web tools via WSL/Kali for best support (ffuf, feroxbuster, gobuster, nikto)."
}
if ($network -and (Confirm-Step "network")) {
  Write-Host "Install nmap/masscan via WSL/Kali or native packages."
}
if ($code -and (Confirm-Step "code")) {
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install --id Git.Git -e --silent
  } else {
    Write-Host "winget not available; install Git manually."
  }
}
if ($cracking -and (Confirm-Step "cracking")) {
  Write-Host "Install hashcat/john in Kali/WSL environment."
}

& "$PSScriptRoot/check-tools.ps1"
