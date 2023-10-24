FROM sharelatex/sharelatex:4.1.3

# Patch: Make history-v1 http request timeout configurable
COPY pr_15409.patch /
RUN cd / && patch -p0 < pr_15409.patch

# Patch: Add verbose logging for I/O in history-v1
COPY pr_15410.patch .
RUN patch -p0 < pr_15410.patch
