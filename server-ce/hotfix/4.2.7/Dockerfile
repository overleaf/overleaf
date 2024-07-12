FROM sharelatex/sharelatex:4.2.6

COPY pr_19293.patch .
RUN patch -p1 < pr_19293.patch && rm pr_19293.patch

COPY pr_19296.patch .
RUN patch -p1 < pr_19296.patch && rm pr_19296.patch

COPY pr_19297.patch .
RUN patch -p1 < pr_19297.patch && rm pr_19297.patch

COPY pr_19071.patch .
RUN patch -p1 < pr_19071.patch && rm pr_19071.patch
