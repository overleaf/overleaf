FROM sharelatex/sharelatex:3.5.11

# Patch: fix matching version when rewinding history
COPY fix-matching-version-error.patch .
RUN patch -p0 < fix-matching-version-error.patch
