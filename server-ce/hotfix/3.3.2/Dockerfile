FROM sharelatex/sharelatex:3.3.0

# Patch: add migration for convert_archived_state script
COPY pr_10442.patch .
RUN patch -p0 < pr_10442.patch
