FROM sharelatex/sharelatex:5.2.0

# Subnet rate limiter fix
COPY pr_21327.patch /
RUN cd / && patch -p0 < pr_21327.patch && rm pr_21327.patch
