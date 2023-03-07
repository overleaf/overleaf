FROM sharelatex/sharelatex:3.5.1

# Patch: improvements to history migration script
COPY migrate_history_fixes.patch .
RUN patch -p0 < migrate_history_fixes.patch
