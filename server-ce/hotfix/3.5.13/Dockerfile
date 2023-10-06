FROM sharelatex/sharelatex:3.5.12

# Patch: fix soft history retry in cron job
COPY history_soft_retry.patch .
RUN patch -p0 < history_soft_retry.patch
