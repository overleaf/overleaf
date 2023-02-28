FROM sharelatex/sharelatex:3.5.0

# Patch: fix German locales
COPY fix_de_locales.patch .
RUN patch -p0 < fix_de_locales.patch
RUN node genScript compile | bash
