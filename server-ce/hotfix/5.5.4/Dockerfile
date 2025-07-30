FROM sharelatex/sharelatex:5.5.3

# ../../bin/import_pr_patch.sh 27504 27505
# Remove CE tests
# Remove web tests
# Fix cron paths
# Move init/shutdown/settings into .patch-abs file
COPY *.patch* .
RUN bash -ec 'for p in *.patch; do echo "=== Applying $p ==="; patch -p1 < "$p" && rm $p; done' \
&&  bash -ec 'cd / && for p in /overleaf/*.patch-abs; do echo "=== Applying $p ==="; patch -p1 < "$p" && rm $p; done'
