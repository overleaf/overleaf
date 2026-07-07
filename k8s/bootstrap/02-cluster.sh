#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLUSTER_NAME="${CLUSTER_NAME:-overleaf}"

export KIND_EXPERIMENTAL_PROVIDER=podman

echo "==> Creating kind cluster '${CLUSTER_NAME}'..."

if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
  echo "  Cluster '${CLUSTER_NAME}' already exists, skipping."
else
 KIND_EXPERIMENTAL_PROVIDER=podman kind create cluster \
    --name "${CLUSTER_NAME}" \
    --config "${SCRIPT_DIR}/../kind/cluster.yaml" \
    --wait 120s
  echo "  [ok] Cluster created."
fi

echo ""
echo "==> Setting kubectl context..."
kubectl cluster-info --context "kind-${CLUSTER_NAME}"

echo ""
echo "Cluster ready. Next: run 03-local-registry.sh"
