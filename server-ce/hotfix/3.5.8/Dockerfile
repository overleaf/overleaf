FROM sharelatex/sharelatex:3.5.7

# Patch: fixes anonymous edits breaking history
COPY pr_13574.patch .
RUN patch -p0 < pr_13574.patch
