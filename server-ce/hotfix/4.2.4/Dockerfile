FROM sharelatex/sharelatex:4.2.3

# Upgrade Node.js to version 18.20.2
RUN apt-get update \
&&  apt-get install -y nodejs=18.20.2-1nodesource1 \
&&  rm -rf /var/lib/apt/lists/*

# Patch: force services to use ipv4 in server-ce container
ADD env.sh /etc/sharelatex/env.sh
COPY pr_17601-1.patch /etc/sharelatex/
RUN cd /etc/sharelatex && patch -p0 < pr_17601-1.patch && rm pr_17601-1.patch
COPY pr_17601-2.patch /overleaf/cron/
RUN cd /overleaf/cron && patch -p0 < pr_17601-2.patch && rm pr_17601-2.patch
COPY pr_17601-3.patch /etc/service/
RUN cd /etc/service && patch -p0 < pr_17601-3.patch && rm pr_17601-3.patch

# Add history utility scripts
ADD bin/* /overleaf/bin/

# Patch: https://github.com/overleaf/internal/pull/17885
COPY pr_17885.patch .
RUN patch -p0 -d /etc/my_init.pre_shutdown.d < pr_17885.patch \
&&  rm pr_17885.patch
