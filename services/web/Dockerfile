# the base image is suitable for running web with /overleaf/services/web bind
# mounted
FROM node:14.18.1 as base

WORKDIR /overleaf/services/web

# install_deps changes app files and installs npm packages
# as such it has to run at a later stage

RUN apt-get update \
&&  apt-get install -y parallel \
&&  rm -rf /var/lib/apt/lists/*

RUN mkdir /overleaf/services/web/node_modules \
&&  chown node:node /overleaf/services/web/node_modules

# the deps image is used for caching npm ci
FROM base as deps

COPY services/web/package.json services/web/package-lock.json /overleaf/services/web/

RUN npm ci --quiet


# the dev is suitable for running tests
FROM deps as dev

COPY services/web /overleaf/services/web

RUN mkdir -p /overleaf/services/web/data/dumpFolder \
&&  mkdir -p /overleaf/services/web/data/logs \
&&  mkdir -p /overleaf/services/web/data/pdf \
&&  mkdir -p /overleaf/services/web/data/uploads \
&&  mkdir -p /overleaf/services/web/data/zippedProjects \
&&  mkdir -p /overleaf/services/web/data/projectHistories \
&&  chmod -R 0755 /overleaf/services/web/data \
&&  chown -R node:node /overleaf/services/web/data

ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=$SENTRY_RELEASE

USER node


# the webpack image has deps+src+webpack artifacts
FROM dev as webpack

USER root
RUN chmod 0755 ./install_deps.sh && ./install_deps.sh


# the final production image without webpack source maps
FROM webpack as app

RUN find /overleaf/services/web/public -name '*.js.map' -delete
RUN rm /overleaf/services/web/modules/server-ce-scripts -rf
USER node

CMD ["node", "--expose-gc", "app.js"]
