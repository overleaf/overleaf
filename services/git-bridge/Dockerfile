# Dockerfile for git-bridge

FROM maven:3-jdk-8 as base

RUN apt-get update && apt-get install -y make git \
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

FROM openjdk:8-jre

RUN apt-get update && apt-get install -y git sqlite3 \
 && rm -rf /var/lib/apt/lists

RUN useradd --create-home node

COPY --from=builder /git-bridge.jar /

COPY vendor/envsubst /opt/envsubst
RUN chmod +x /opt/envsubst

COPY conf/envsubst_template.json envsubst_template.json
COPY start.sh start.sh

RUN mkdir conf
RUN chown node:node conf

USER node

CMD ["/start.sh"]
