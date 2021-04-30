# Dockerfile for git-bridge

FROM maven:3-jdk-8 as base

RUN apt-get update && apt-get install -y make \
 && rm -rf /var/lib/apt/lists

RUN useradd --create-home node

FROM base as builder

WORKDIR /app

COPY . /app
RUN make package \
# The name of the created jar contains the current version tag.
# Rename it to a static path that can be used for copying.
&&  find /app/target \
      -name 'writelatex-git-bridge*jar-with-dependencies.jar' \
      -exec mv {} /git-bridge.jar \;

FROM openjdk:8-jre

RUN apt-get update && apt-get install -y git gettext-base\
 && rm -rf /var/lib/apt/lists

RUN useradd --create-home node

CMD ["/start.sh"]

COPY --from=builder /git-bridge.jar /

COPY conf/envsubst_template.json envsubst_template.json
COPY start.sh start.sh

RUN mkdir conf
RUN chown node:node conf

USER node
