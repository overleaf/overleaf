FROM sharelatex/sharelatex:6.0.0

# Apply security updates to base image
RUN apt update && apt install -y linux-libc-dev \
  && unattended-upgrade --verbose --no-minimal-upgrade-steps \
  && rm -rf /var/lib/apt/lists/*

# Update mongo compatibility versions
COPY mongo-version.patch .
RUN patch -p1 < mongo-version.patch && rm mongo-version.patch
