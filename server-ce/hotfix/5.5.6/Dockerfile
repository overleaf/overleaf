FROM sharelatex/sharelatex:5.5.5

RUN apt update \
    && unattended-upgrade --verbose --no-minimal-upgrade-steps \
    && rm -rf /var/lib/apt/lists/*
