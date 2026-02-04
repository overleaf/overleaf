# Build the a8m/envsubst binary, as it supports default values,
# which the gnu envsubst (from gettext-base) does not.
FROM golang:1.25.5-alpine AS envsubst_builder

WORKDIR /build

RUN go install github.com/a8m/envsubst/cmd/envsubst@latest

FROM maven:3-amazoncorretto-21-debian AS base

RUN apt-get update && apt-get install -y make git sqlite3 \
 && rm -rf /var/lib/apt/lists

COPY --from=envsubst_builder /go/bin/envsubst /opt/envsubst
RUN chmod +x /opt/envsubst

RUN useradd --create-home node

FROM base AS builder

COPY . /app

WORKDIR /app

RUN make package \
# The name of the created jar contains the current version tag.
# Rename it to a static path that can be used for copying.
&&  find /app/target \
      -name 'writelatex-git-bridge*jar-with-dependencies.jar' \
      -exec mv {} /git-bridge.jar \;

FROM amazoncorretto:21-alpine

RUN apk add --update --no-cache bash git sqlite procps htop net-tools jemalloc util-linux

ENV LD_PRELOAD=/usr/lib/libjemalloc.so.2

RUN adduser -D node

COPY --from=builder /git-bridge.jar /

COPY --from=envsubst_builder /go/bin/envsubst /opt/envsubst
RUN chmod +x /opt/envsubst

COPY conf/envsubst_template.json envsubst_template.json
COPY start.sh start.sh
COPY server-pro-start.sh server-pro-start.sh

RUN mkdir conf
RUN chown node:node conf

USER node

CMD ["/start.sh"]
