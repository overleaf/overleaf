FROM sharelatex/sharelatex:5.0.4

# Install dev dependencies as part of "genScript compile"
COPY pr_18570.patch .
RUN patch -p1 < pr_18570.patch && rm pr_18570.patch

# Adopted from https://github.com/overleaf/internal/pull/18819
COPY pr_18819.patch .
RUN patch -p1 < pr_18819.patch && rm pr_18819.patch

# Recompile frontend assets
RUN node genScript compile | bash
