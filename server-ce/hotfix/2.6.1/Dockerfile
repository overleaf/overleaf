FROM sharelatex/sharelatex:2.6.0-RC1

# Patch: fixes Project restore inserts bad projectId into deletedFiles
COPY document-deleter-object-id.patch ${baseDir}
RUN cd ${baseDir} && patch -p0 < document-deleter-object-id.patch
