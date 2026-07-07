#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARGOCD_NAMESPACE="argocd"

echo "==> Adding ArgoCD Helm repo..."
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update argo

echo ""
echo "==> Installing ArgoCD into namespace '${ARGOCD_NAMESPACE}'..."
helm upgrade --install argocd argo/argo-cd \
  --namespace "${ARGOCD_NAMESPACE}" \
  --create-namespace \
  --values "${SCRIPT_DIR}/../argocd/values.yaml" \
  --timeout 10m \
  --wait

echo ""
echo "==> Waiting for ArgoCD server..."
kubectl rollout status deployment/argocd-server -n "${ARGOCD_NAMESPACE}" --timeout=300s

echo ""
echo "==> Logging into ArgoCD CLI..."
ARGOCD_PASSWORD=$(kubectl get secret argocd-initial-admin-secret \
  -n "${ARGOCD_NAMESPACE}" \
  -o jsonpath="{.data.password}" | base64 -d)

argocd login localhost:30080 \
  --username admin \
  --password "${ARGOCD_PASSWORD}" \
  --insecure

echo ""
echo "==> Applying Overleaf Application..."
kubectl apply -f "${SCRIPT_DIR}/../argocd/application.yaml"

echo ""
echo "ArgoCD is up at http://localhost:30080"
echo "  User: admin  /  Password: ${ARGOCD_PASSWORD}"
echo ""
echo "To watch sync status:"
echo "  argocd app get overleaf"
echo "  argocd app sync overleaf"
echo ""
echo "Next: run 05-build-push.sh, then sync the app."
