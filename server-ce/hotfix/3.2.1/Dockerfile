FROM sharelatex/sharelatex:3.2.0

# Patch: fixes source editor broken
# https://github.com/overleaf/overleaf/issues/1043
COPY disable-codemirror.patch .
RUN patch -p0 < disable-codemirror.patch
