FROM sharelatex/sharelatex:2.4.1


# Patch: Fixes anonymous read/write sharing
COPY anonymous-metadata.patch ${baseDir}
RUN cd ${baseDir} && patch -p0 < anonymous-metadata.patch
