FROM sharelatex/sharelatex:3.5.10

# Patch: Drop the old history collections and increase mongo query timeout
ADD clean_sl_history_data.js /overleaf/services/web/scripts/history/clean_sl_history_data.js

# Patch: convert large deleted docs to files
COPY pr_14200.patch .
RUN patch -p0 < pr_14200.patch
