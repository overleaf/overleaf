# Overleaf — Local Kubernetes Bootstrap

Runs Overleaf Community Edition on a local [kind](https://kind.sigs.k8s.io/) cluster
[Argo CD](https://argo-cd.readthedocs.io/) for GitOps deployment.
All runtime images are pulled exclusively from localhost:5001 once bootstrapped.

## Architecture

```
macOS (podman)
│
├── kind cluster (podman provider)
│   ├── local-repo  :5001  — local OCI registry
│   ├── Argo CD :30080  — GitOps controller
│   └── overleaf namespace
│       ├── overleaf  :30000
│       ├── mongo
│       └── redis
│
└── podman build → push → localhost:5001
```

## Prerequisites

- macOS with [Homebrew](https://brew.sh/)
- `brew install kind kubectl helm podman argocd`

Run the prereqs check:

```bash
./k8s/bootstrap/01-prereqs.sh
```

This also initialises and starts the podman machine if one isn't running.

## Step 1 — Create the kind cluster

```bash
./k8s/bootstrap/02-cluster.sh
```

What it does:
- Creates a single-node kind cluster named `overleaf` using `k8s/kind/cluster.yaml`
- Adds `localhost:5001` as an insecure registry in `~/.config/containers/registries.conf`

> **Podman note**: kind uses `KIND_EXPERIMENTAL_PROVIDER=podman` automatically.
> Port bindings go through the podman machine — `localhost:5001` on macOS reaches the local registry in podman

## Step 2 — Install Local Registry

```bash
./k8s/bootstrap/03-local-registry.sh
```

Access at **http://localhost:5001/v2** 

## Step 3 — Install Argo CD

```bash
./k8s/bootstrap/04-argocd.sh
```

Installs Argo CD via Helm and registers the Overleaf `Application` from
`k8s/argocd/application.yaml`. Argo CD watches `k8s/charts/overleaf/` in the
configured git repo and syncs on every commit.

Access at **http://localhost:30080** — credentials printed by the script.

> By default `application.yaml` points at `https://github.com/overleaf/overleaf.git`.
> For a fully sandboxed setup, deploy [Gitea](https://gitea.io/) inside the cluster
> and update `repoURL` to point there.

## Step 4 — Build overleaf and push all images to Local Registry

```bash
./k8s/bootstrap/05-build-push.sh
```

Builds the overleaf image locally from `server-ce/` using podman, then pushes
all three images to Local Registry:

| Image | Local Registry tag |
|-------|-----------|
| built from `server-ce/Dockerfile-base` | `localhost:5001/overleaf/overleaf-base:local` |
| built from `server-ce/Dockerfile` | `localhost:5001/overleaf/overleaf:local` |
| `mongo:8.0` (mirrored from Docker Hub) | `localhost:5001/overleaf/mongo:8.0` |
| `redis:6.2` (mirrored from Docker Hub) | `localhost:5001/overleaf/redis:6.2` |

After this step the cluster is fully sandboxed for runtime — no external pulls happen.

> **Podman version**: `COPY --parents` in `server-ce/Dockerfile` requires
> **podman 4.8+ / Buildah 1.32+**. Check with `podman --version`.
>
> Override the image tag with `TAG=myfeature ./k8s/bootstrap/05-build-push.sh`,
> then set `overleaf.image.tag: myfeature` in `k8s/charts/overleaf/values.yaml`.

## Step 5 — Sync and access Overleaf

```bash
argocd app sync overleaf
argocd app wait overleaf --health
```

Overleaf will be available at **http://localhost:30000**.

Create an admin account:

```bash
kubectl exec -n overleaf deploy/overleaf -- \
  /bin/bash -c "cd /overleaf/services/web && node modules/server-ce-scripts/scripts/create-user --admin --email admin@example.com"
```

## Day-to-day workflow

### Rebuild and redeploy

```bash
# Build with a custom tag
TAG=myfeature ./k8s/bootstrap/05-build-push.sh

# Update the tag and sync
# Edit k8s/charts/overleaf/values.yaml: overleaf.image.tag: myfeature
argocd app sync overleaf
```

Or build manually:

```bash
cp server-ce/.dockerignore .
podman build -f server-ce/Dockerfile-base -t localhost:5001/overleaf/overleaf-base:dev .
podman build -f server-ce/Dockerfile \
  --build-arg OVERLEAF_BASE_TAG=localhost:5001/overleaf/overleaf-base:dev \
  -t localhost:5001/overleaf/overleaf:dev .
podman push localhost:5001/overleaf/overleaf:dev --tls-verify=false
```

### Iterate on Helm chart changes

Edit files under `k8s/charts/overleaf/`, commit, push to the tracked branch,
then `argocd app sync overleaf`. Argo CD can also auto-sync on every push if
the webhook is configured.

### Tear down

```bash
kind delete cluster --name overleaf
```

## File layout

```
k8s/
├── README.md
├── kind/
│   └── cluster.yaml              kind cluster config (podman, port mappings, containerd registry mirror)
├── argocd/
│   ├── values.yaml               Argo CD Helm values (NodePort, insecure mode)
│   └── application.yaml          Argo CD Application pointing to k8s/charts/overleaf
├── charts/
│   └── overleaf/
│       ├── Chart.yaml
│       ├── values.yaml           Image refs, resource limits, env vars
│       └── templates/
│           ├── mongo-*           Deployment, Service, PVC, ConfigMap (replica-set init)
│           ├── redis-*           Deployment, Service, PVC
│           └── overleaf-*     Deployment, Service (NodePort 30000), PVC, Ingress (disabled by default)
└── bootstrap/
    ├── 01-prereqs.sh
    ├── 02-cluster.sh
    ├── 03-local-registry.sh
    ├── 04-argocd.sh
    └── 05-build-push.sh
```

## Known limitations

- **Sandboxed compiles** (`SANDBOXED_COMPILES`) are disabled. That feature requires
  Docker sibling containers, which needs a privileged DinD sidecar in Kubernetes.
- Local Repo is HTTP-only. 
- The Argo CD `Application` uses the public GitHub remote. For offline use, add
  Gitea to the cluster and mirror the repo there.
