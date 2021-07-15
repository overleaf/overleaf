# Dockerfile for git-bridge

FROM maven:3-jdk-11 as base

RUN apt-get update && apt-get install -y make git sqlite3 build-essential dpkg-dev

RUN echo "deb-src http://deb.debian.org/debian buster main" >> /etc/apt/sources.list && \
    echo "deb-src http://deb.debian.org/debian buster-updates main" >> /etc/apt/sources.list && \
    echo "deb-src http://security.debian.org/debian-security buster/updates main" >> /etc/apt/sources.list

RUN mkdir -p /build
WORKDIR /build

RUN apt-get update && \
    apt-get -y source libjemalloc-dev && \
    apt-get -y build-dep libjemalloc-dev && \
    echo "override_dh_auto_configure:" >> jemalloc-5.1.0/debian/rules && \
    echo "\tdh_auto_configure -- --enable-debug --enable-fill --enable-prof --enable-stat" >> jemalloc-5.1.0/debian/rules && \
    cat jemalloc-5.1.0/debian/rules

WORKDIR /build/jemalloc-5.1.0
RUN dpkg-buildpackage

RUN rm -rf /var/lib/apt/lists

COPY vendor/envsubst /opt/envsubst
RUN chmod +x /opt/envsubst

RUN useradd --create-home node

FROM base as builder

COPY . /app

WORKDIR /app

RUN make package \
# The name of the created jar contains the current version tag.
# Rename it to a static path that can be used for copying.
&&  find /app/target \
      -name 'writelatex-git-bridge*jar-with-dependencies.jar' \
      -exec mv {} /git-bridge.jar \;

FROM openjdk:11-jre

RUN apt-get update && apt-get install -y git sqlite3 procps htop net-tools sockstat binutils graphviz \
 && rm -rf /var/lib/apt/lists

# Install Google Cloud Profiler agent
RUN mkdir -p /opt/cprof && \
  wget -q -O- https://storage.googleapis.com/cloud-profiler/java/latest/profiler_java_agent.tar.gz \
  | tar xzv -C /opt/cprof

# Install Google Cloud Debugger agent
RUN mkdir /opt/cdbg && \
  wget -qO- https://storage.googleapis.com/cloud-debugger/compute-java/debian-wheezy/cdbg_java_agent_gce.tar.gz | \
  tar xvz -C /opt/cdbg

RUN useradd --create-home node

COPY --from=builder /git-bridge.jar /
COPY --from=builder /build/*.deb /tmp/

RUN dpkg -i /tmp/libjemalloc*.deb

COPY vendor/envsubst /opt/envsubst
RUN chmod +x /opt/envsubst

COPY conf/envsubst_template.json envsubst_template.json
COPY start.sh start.sh

RUN mkdir conf
RUN chown node:node conf

USER node

CMD ["/start.sh"]
