FROM sharelatex/sharelatex:5.5.6

# Apply security updates to base image
RUN apt update && apt install -y linux-libc-dev \
  && unattended-upgrade --verbose --no-minimal-upgrade-steps \
  && rm -rf /var/lib/apt/lists/*
