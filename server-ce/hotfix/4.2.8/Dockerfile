FROM sharelatex/sharelatex:4.2.7

# Fix crash on on invalid URLs
COPY pr_19612.patch .
RUN patch -p1 < pr_19612.patch && rm pr_19612.patch

COPY pr_19550.patch .
RUN patch -p1 < pr_19550.patch && rm pr_19550.patch

COPY is_19575.patch /etc/nginx/sites-enabled/
RUN cd /etc/nginx/sites-enabled && patch -p0 < is_19575.patch && rm is_19575.patch
