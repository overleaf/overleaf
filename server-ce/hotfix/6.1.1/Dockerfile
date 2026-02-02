FROM sharelatex/sharelatex:6.1.0

# Apply security updates to base image
RUN apt update && apt install -y linux-libc-dev \
  && unattended-upgrade --verbose --no-minimal-upgrade-steps \
  && rm -rf /var/lib/apt/lists/*

# Fix rendering logic for UI elements in the redesigned editor
COPY pr_31004.patch .
RUN patch -p1 < pr_31004.patch && rm pr_31004.patch

RUN node genScript compile | bash
