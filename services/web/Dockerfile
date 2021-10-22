# the base image is suitable for running web with /app bind mounted
FROM node:12.22.7 as base

WORKDIR /app

# install_deps changes app files and installs npm packages
# as such it has to run at a later stage

RUN apt-get update \
&&  apt-get install -y parallel \
&&  rm -rf /var/lib/apt/lists/*

RUN mkdir /app/node_modules && chown node:node /app/node_modules

# the deps image is used for caching npm ci
FROM base as deps

COPY package.json package-lock.json /app/

RUN npm ci --quiet


# the dev is suitable for running tests
FROM deps as dev

COPY . /app

RUN mkdir -p /app/data/dumpFolder && \
  mkdir -p /app/data/logs && \
  mkdir -p /app/data/pdf && \
  mkdir -p /app/data/uploads && \
  mkdir -p /app/data/zippedProjects && \
  chmod -R 0755 /app/data/ && \
  chown -R node:node /app/data/

ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=$SENTRY_RELEASE

USER node


# the webpack image has deps+src+webpack artifacts
FROM dev as webpack

USER root
RUN chmod 0755 ./install_deps.sh && ./install_deps.sh


# the final production image without webpack source maps
FROM webpack as app

RUN find /app/public -name '*.js.map' -delete
RUN rm /app/modules/server-ce-scripts -rf
USER node

CMD ["node", "--expose-gc", "app.js"]
