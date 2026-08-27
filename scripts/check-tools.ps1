$tools = @("subfinder","dnsx","httpx","naabu","katana","nuclei","nmap","masscan","ffuf","feroxbuster","gobuster","nikto","whatweb","testssl.sh","netexec","semgrep","gitleaks","trufflehog","hashcat","john")
Write-Host "[+] Platform: $([System.Environment]::OSVersion.VersionString)"
foreach ($tool in $tools) {
  $cmd = Get-Command $tool -ErrorAction SilentlyContinue
  if ($cmd) {
    $version = "UNKNOWN VERSION"
    try { $version = (& $tool --version | Select-Object -First 1) } catch {}
    Write-Host "INSTALLED | $tool | $($cmd.Source) | $version"
  } else {
    Write-Host "MISSING   | $tool"
  }
}
