FROM sharelatex/sharelatex:5.5.2

# ../../bin/import_pr_patch.sh 27147 27173 27230 27240 27249 27257 27273 27397
# Remove CE tests
# Remove tests
# Remove cloudbuild changes
# Remove SaaS changes
# Fixup package.json and toolbar-items.tsx
# Fix cron paths
COPY *.patch .
RUN --mount=type=cache,target=/root/.cache \
  --mount=type=cache,target=/root/.npm \
  --mount=type=cache,target=/overleaf/services/web/node_modules/.cache,id=server-ce-webpack-cache \
  --mount=type=tmpfs,target=/tmp true \
  &&  bash -ec 'for p in *.patch; do echo "=== Applying $p ==="; patch -p1 < "$p" && rm $p; done' \
  &&  npm audit --audit-level=high \
  &&  node genScript compile | bash \
  &&  npm prune --omit=dev \
  &&  apt remove -y linux-libc-dev

# ../../bin/import_pr_patch.sh 27476
# Remove tests
# Remove SaaS changes
COPY pr_27476.patch-stage-2 .
RUN patch -p1 < pr_27476.patch-stage-2 && rm pr_27476.patch-stage-2

# Extra tweaks to output
COPY pr_27397.patch-stage-2 .
RUN patch -p1 < pr_27397.patch-stage-2 && rm pr_27397.patch-stage-2
