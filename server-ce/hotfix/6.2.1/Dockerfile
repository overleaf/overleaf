FROM sharelatex/sharelatex:6.2.0

# [real-time] add strict validation for incoming applyOtUpdate messages
COPY pr_35045.patch .
RUN patch -p1 < pr_35045.patch && rm pr_35045.patch

# [real-time] gracefully handle undefined meta.tc
COPY pr_35049.patch .
RUN patch -p1 < pr_35049.patch && rm pr_35049.patch

# [web] avoid sending empty sharejs op
COPY pr_35066.patch .
RUN patch -p1 < pr_35066.patch && rm pr_35066.patch
RUN node genScript compile | bash
