#!/usr/bin/env bash
set -euo pipefail

GROUP=${1:-""}
if [[ -z "$GROUP" ]]; then
  echo "Usage: $0 --projectdiscovery|--web|--network|--code|--cracking|--all"
  exit 1
fi

if command -v apt-get >/dev/null 2>&1; then
  PM="apt"
elif command -v dnf >/dev/null 2>&1; then
  PM="dnf"
else
  echo "Unsupported package manager"
  exit 1
fi

install_apt() {
  sudo apt-get update
  sudo apt-get install -y "$@"
}

install_dnf() {
  sudo dnf install -y "$@"
}

install_pkg() {
  if [[ "$PM" == "apt" ]]; then install_apt "$@"; else install_dnf "$@"; fi
}

confirm() {
  read -r -p "Install group $1? [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]]
}

case "$GROUP" in
  --projectdiscovery)
    confirm "$GROUP" || exit 0
    install_pkg golang-go
    go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
    go install github.com/projectdiscovery/dnsx/cmd/dnsx@latest
    go install github.com/projectdiscovery/httpx/cmd/httpx@latest
    go install github.com/projectdiscovery/naabu/v2/cmd/naabu@latest
    go install github.com/projectdiscovery/katana/cmd/katana@latest
    go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
    ;;
  --web)
    confirm "$GROUP" || exit 0
    install_pkg ffuf feroxbuster gobuster nikto nmap
    ;;
  --network)
    confirm "$GROUP" || exit 0
    install_pkg nmap masscan
    ;;
  --code)
    confirm "$GROUP" || exit 0
    install_pkg git
    ;;
  --cracking)
    confirm "$GROUP" || exit 0
    install_pkg hashcat john
    ;;
  --all)
    confirm "$GROUP" || exit 0
    "$0" --projectdiscovery
    "$0" --web
    "$0" --network
    "$0" --code
    "$0" --cracking
    ;;
  *)
    echo "Unknown flag: $GROUP"
    exit 1
    ;;
esac

echo "[+] Verify installation"
"$(dirname "$0")/check-tools.sh"
