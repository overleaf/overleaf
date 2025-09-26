FROM sharelatex/sharelatex:5.5.4

# ../../bin/import_pr_patch.sh 27932
# Remove web migrations changes
# Remove test changes
# Add init script change (commit cc83a526ecd86ed7b1a0e061b074d2fb15d4d672 in PR 28738)
COPY *.patch* .
RUN bash -ec 'for p in *.patch; do echo "=== Applying $p ==="; patch -p1 < "$p" && rm $p; done' \
&&  bash -ec 'cd / && for p in /overleaf/*.patch-abs; do echo "=== Applying $p ==="; patch -p1 < "$p" && rm $p; done'
