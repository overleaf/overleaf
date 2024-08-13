FROM sharelatex/sharelatex:5.1.0

# Confirmation email fix
COPY pr_19676.patch .
RUN patch -p1 < pr_19676.patch && rm pr_19676.patch

# Fix crash on on invalid URLs
COPY pr_19612.patch .
RUN patch -p1 < pr_19612.patch && rm pr_19612.patch

# Remove Editor Resources check from launchpad
COPY pr_19543.patch .
RUN patch -p1 < pr_19543.patch && rm pr_19543.patch

COPY pr_19550.patch .
RUN patch -p1 < pr_19550.patch && rm pr_19550.patch

COPY is_19575.patch /etc/nginx/sites-enabled/
RUN cd /etc/nginx/sites-enabled && patch -p0 < is_19575.patch && rm is_19575.patch

