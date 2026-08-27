#!/usr/bin/env bash
set -euo pipefail

TOOLS=(subfinder dnsx httpx naabu katana nuclei nmap masscan ffuf feroxbuster gobuster nikto whatweb testssl.sh netexec semgrep gitleaks trufflehog hashcat john)

echo "[+] OS: $(uname -a)"
for tool in "${TOOLS[@]}"; do
  if command -v "$tool" >/dev/null 2>&1; then
    path=$(command -v "$tool")
    version=$($tool --version 2>/dev/null | head -n 1 || true)
    [[ -z "$version" ]] && version="UNKNOWN VERSION"
    echo "INSTALLED | $tool | $path | $version"
  else
    echo "MISSING   | $tool"
  fi
done
