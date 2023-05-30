FROM sharelatex/sharelatex:4.0.0

# Patch: Block access to metrics endpoint
COPY pr_13229_ce_only.patch .
RUN patch -p0 --directory=/ < pr_13229_ce_only.patch

# Patch: Remove documentation link from editor outline
COPY outline_doc_icon.patch .
RUN patch -p0 < outline_doc_icon.patch
