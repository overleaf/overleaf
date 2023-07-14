FROM sharelatex/sharelatex:3.5.8

# Node update
RUN curl -sSL https://deb.nodesource.com/setup_16.x | bash - \
    && apt-get install -y nodejs

# Patch: fetch access tokens via endpoint
COPY pr_13485.patch .
RUN patch -p0 < pr_13485.patch
RUN node genScript compile | bash
