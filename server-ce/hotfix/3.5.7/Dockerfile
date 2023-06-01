FROM sharelatex/sharelatex:3.5.6

# Patch: clean up history id on `migrate_history.js --force-clean`
COPY force_clean_fix.patch .
RUN patch -p0 < force_clean_fix.patch
