FROM sharelatex/sharelatex:5.5.7

# Apply security updates to base image
RUN apt update && apt install -y linux-libc-dev \
  && unattended-upgrade --verbose --no-minimal-upgrade-steps \
  && apt purge -y imagemagick \
  && apt autoremove -y \
  && apt install -y poppler-utils \
  && rm -rf /var/lib/apt/lists/*

# Update converter
COPY issue_31527.patch .
RUN patch -p0 < issue_31527.patch && rm issue_31527.patch
