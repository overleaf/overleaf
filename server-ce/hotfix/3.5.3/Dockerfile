FROM sharelatex/sharelatex:3.5.2

# Patch: remove stats collection from history migration script
COPY remove_stats_collection.patch .
RUN patch -p0 < remove_stats_collection.patch
