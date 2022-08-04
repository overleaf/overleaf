FROM sharelatex/sharelatex:3.1.0

# Patch: fixes Sharelatex History navigation
# https://github.com/overleaf/overleaf/issues/1035
COPY fix-history-navigation.patch .
RUN patch -p0 < fix-history-navigation.patch


# Rebuild client
# --------------
RUN node genScript compile | bash
