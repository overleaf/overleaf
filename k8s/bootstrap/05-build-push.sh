#!/usr/bin/env bash
# Builds overleaf from server-ce/ using podman and pushes all images to Registry
# Requires podman 4.8+ (Buildah 1.32+) for COPY --parents support.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SERVER_CE="${REPO_ROOT}/server-ce"

REGISTRY="localhost:5001"
PROJECT="overleaf"
PASSWORD="passwordr12345"

TAG="${TAG:-local}"
BASE_IMAGE="${REGISTRY}/${PROJECT}/overleaf-base:${TAG}"
APP_IMAGE="${REGISTRY}/${PROJECT}/overleaf:${TAG}"

echo "==> Logging podman into Registry..."
podman login "${REGISTRY}" \
  --username admin \
  --password "${PASSWORD}" \
  --tls-verify=false

# The Dockerfiles expect the build context to be the repo root.
# server-ce/.dockerignore must be present at the repo root before building.
echo ""
echo "==> Copying .dockerignore to repo root..."
cp "${SERVER_CE}/.dockerignore" "${REPO_ROOT}/.dockerignore"

echo ""
echo "==> Building base image (server-ce/Dockerfile-base)..."
podman build \
  --progress=plain \
  --file "${SERVER_CE}/Dockerfile-base" \
  --tag "${BASE_IMAGE}" \
  "${REPO_ROOT}"

echo ""
echo "==> Building app image (server-ce/Dockerfile)..."
podman build \
  --progress=plain \
  --file "${SERVER_CE}/Dockerfile" \
  --build-arg "OVERLEAF_BASE_TAG=${BASE_IMAGE}" \
  --tag "${APP_IMAGE}" \
  "${REPO_ROOT}"

echo ""
echo "==> Pushing images to Registry..."
podman push "${BASE_IMAGE}" --tls-verify=false
podman push "${APP_IMAGE}" --tls-verify=false

echo ""
echo "==> Mirroring mongo and redis into Local Registry..."
for PAIR in "mongo:8.0" "redis:6.2"; do
  DST="${REGISTRY}/${PROJECT}/${PAIR}"
  echo "  ${PAIR} → ${DST}"
  podman pull "${PAIR}"
  podman tag "${PAIR}" "${DST}"
  podman push "${DST}" --tls-verify=false
done

echo ""
echo "Done. Images in Registry:"
echo "  ${BASE_IMAGE}"
echo "  ${APP_IMAGE}"
echo "  ${REGISTRY}/${PROJECT}/mongo:8.0"
echo "  ${REGISTRY}/${PROJECT}/redis:6.2"
echo ""
echo "Update k8s/charts/overleaf/values.yaml if TAG is not 'local', then:"
echo "  argocd app sync overleaf"
