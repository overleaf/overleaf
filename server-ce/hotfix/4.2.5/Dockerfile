FROM sharelatex/sharelatex:4.2.4

# apply an override to the swagger-tools package to force security updates to multer and qs
# from https://github.com/overleaf/internal/pull/18433
COPY pr_18433.patch .
RUN patch -p1 < pr_18433.patch && rm pr_18433.patch
RUN npm install --include-workspace-root -w services/history-v1 swagger-tools@0.10.4 && rm -rf /root/.cache /root/.npm $(find /tmp/ -mindepth 1 -maxdepth 1)

# remove google-cloud packages which are unused in server-pro have a vulnerable dependency
RUN npm uninstall -w libraries/logger @google-cloud/logging-bunyan
RUN npm uninstall -w libraries/metrics @google-cloud/opentelemetry-cloud-trace-exporter @google-cloud/profiler

# the passport-twitter package has been removed from the monorepo
RUN npm uninstall -w services/web passport-twitter

# remove the unused services/web/scripts/translations directory
RUN rm -r services/web/scripts/translations

COPY pr_18393.patch .
RUN patch -p1 < pr_18393.patch && rm pr_18393.patch
COPY pr_18444.patch .
RUN patch -p1 < pr_18444.patch && rm pr_18444.patch
COPY pr_18819.patch .
RUN patch -p1 < pr_18819.patch && rm pr_18819.patch
COPY pr_18570.patch .
RUN patch -p1 < pr_18570.patch && rm pr_18570.patch

# Recompile frontend assets
RUN node genScript compile | bash
