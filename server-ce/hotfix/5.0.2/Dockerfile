FROM sharelatex/sharelatex:5.0.1

# Upgrade Node.js to version 18.20.2
RUN apt-get update \
&&  apt-get install -y nodejs=18.20.2-1nodesource1 \
&&  rm -rf /var/lib/apt/lists/*

# Patch: https://github.com/overleaf/internal/pull/17843
COPY pr_17843.patch .
RUN patch -p0 < pr_17843.patch \
&&  rm pr_17843.patch

# Add history utility scripts
ADD bin/* /overleaf/bin/

# Patch: https://github.com/overleaf/internal/pull/17885
COPY pr_17885.patch .
RUN patch -p0 -d /etc/my_init.pre_shutdown.d < pr_17885.patch \
&&  rm pr_17885.patch

# Recompile frontend for Grammarly patch in 5.0.1
RUN node genScript compile | bash

# Patch: https://github.com/overleaf/internal/pull/17960
COPY pr_17960.patch .
RUN patch -p0 < pr_17960.patch \
&&  rm pr_17960.patch

# Fix bad ordering of migrations
RUN mv /overleaf/services/web/migrations/20231219081700_move_doc_versions_from_docops_to_docs.js \
       /overleaf/services/web/migrations/20231105000000_move_doc_versions_from_docops_to_docs.js

# Add doc versions recovery scripts
ADD 910_initiate_doc_version_recovery /etc/my_init.d/910_initiate_doc_version_recovery
ADD recover_doc_versions.js /overleaf/services/history-v1/storage/scripts/recover_doc_versions.js
