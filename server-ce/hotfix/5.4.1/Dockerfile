FROM sharelatex/sharelatex:5.4.0

RUN apt update && apt install -y linux-libc-dev \
    && unattended-upgrade --verbose --no-minimal-upgrade-steps \
    && rm -rf /var/lib/apt/lists/*
COPY package-lock.json.diff .
RUN patch package-lock.json < package-lock.json.diff
RUN npm install --omit=dev


# fix tls configuration in redis
COPY issue_24996.patch .
RUN patch -p0 /etc/overleaf/settings.js < issue_24996.patch \
    && rm issue_24996.patch
