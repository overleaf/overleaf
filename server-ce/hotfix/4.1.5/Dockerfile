FROM sharelatex/sharelatex:4.1.4

# Patch: Change streaming compression in history-v1
COPY pr_15445.patch .
RUN patch -p0 < pr_15445.patch
