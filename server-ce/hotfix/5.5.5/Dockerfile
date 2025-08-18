FROM sharelatex/sharelatex:5.5.4

# ../../bin/import_pr_patch.sh 27932
# Remove web migrations changes
# Remove test changes
COPY *.patch .
RUN bash -ec 'for p in *.patch; do echo "=== Applying $p ==="; patch -p1 < "$p" && rm $p; done'
