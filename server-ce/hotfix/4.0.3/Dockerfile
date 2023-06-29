# 4.0.1 was tagged as 4.0.2 in dockerhub to keep parity with Server Pro
FROM sharelatex/sharelatex:4.0.1


# Patch: fixes anonymous edits breaking history
COPY pr_13574.patch .
RUN patch -p0 < pr_13574.patch
