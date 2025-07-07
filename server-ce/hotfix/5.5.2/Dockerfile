FROM sharelatex/sharelatex:5.5.1

# https://github.com/overleaf/internal/pull/25944
# Removed changes to services/web/frontend/js/features/ide-redesign/components/rail.tsx due to incompatibility with 5.5.1
COPY pr_25944.patch .
RUN patch -p1 < pr_25944.patch && rm pr_25944.patch

# https://github.com/overleaf/internal/pull/26637
# Removed changes to server-ce/test/create-and-compile-project.spec.ts and server-ce/test/helpers/compile.ts due to incompatibility with 5.5.1
COPY pr_26637.patch .
RUN patch -p1 < pr_26637.patch && rm pr_26637.patch

# https://github.com/overleaf/internal/pull/26783
COPY pr_26783.patch .
RUN patch -p1 < pr_26783.patch && rm pr_26783.patch

# https://github.com/overleaf/internal/pull/26697
COPY pr_26697.patch .
RUN patch -p1 < pr_26697.patch && rm pr_26697.patch

# Apply security updates to base image
RUN apt update && apt install -y linux-libc-dev \
  && unattended-upgrade --verbose --no-minimal-upgrade-steps \
  && rm -rf /var/lib/apt/lists/*

# Recompile frontend assets
RUN node genScript compile | bash
