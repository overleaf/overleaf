# Dockerfile for git-bridge

FROM maven:3-jdk-11 as base

RUN apt-get update && apt-get install -y make git sqlite3 \
 && rm -rf /var/lib/apt/lists

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

RUN apt-get update && apt-get install -y git sqlite3 procps htop net-tools sockstat libjemalloc2 \
 && rm -rf /var/lib/apt/lists

ENV LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2

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

COPY vendor/envsubst /opt/envsubst
RUN chmod +x /opt/envsubst

COPY conf/envsubst_template.json envsubst_template.json
COPY start.sh start.sh
COPY server-pro-start.sh server-pro-start.sh

RUN mkdir conf
RUN chown node:node conf

USER node

CMD ["/start.sh"]
