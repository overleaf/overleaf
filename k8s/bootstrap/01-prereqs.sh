#!/usr/bin/env bash
set -euo pipefail

REQUIRED_TOOLS=(kind kubectl helm podman argocd)
MISSING=()

for tool in "${REQUIRED_TOOLS[@]}"; do
  if ! command -v "$tool" &>/dev/null; then
    MISSING+=("$tool")
  else
    echo "  [ok] $tool $(${tool} version --short 2>/dev/null || ${tool} --version 2>/dev/null | head -1)"
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo ""
  echo "Missing tools: ${MISSING[*]}"
  echo ""
  echo "Install via Homebrew:"
  echo "  brew install kind kubectl helm podman"
  echo "  brew install argocd"
  exit 1
fi

echo ""
echo "Checking podman machine..."
if ! podman machine list 2>/dev/null | grep -q running; then
  echo "  No running podman machine found. Starting default machine..."
  podman machine init --memory 8192 --cpus 4 --disk-size 20 2>/dev/null || true
  #podman machine init 2>/dev/null || true
  podman machine start
else
  echo "  [ok] podman machine running"
fi

echo ""
echo "All prerequisites satisfied."
