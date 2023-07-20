FROM sharelatex/sharelatex:3.5.9

# Patch: clear invite and invite tokens through the websocket
COPY pr_13427.patch .
RUN patch -p0 < pr_13427.patch

# Patch: https://github.com/Automattic/mongoose/commit/f1efabf350522257364aa5c2cb36e441cf08f1a2
COPY mongoose_proto.patch .
RUN patch -p0 < mongoose_proto.patch
