# the base image is suitable for running web with /overleaf/services/web bind
# mounted
FROM node:16.14.2 as base

WORKDIR /overleaf/services/web

# install_deps changes app files and installs npm packages
# as such it has to run at a later stage

# Google Cloud Storage needs a writable $HOME/.config for resumable uploads
# (see https://googleapis.dev/nodejs/storage/latest/File.html#createWriteStream)
RUN mkdir /home/node/.config && chown node:node /home/node/.config

# the deps image is used for caching npm ci
FROM base as deps

COPY package.json package-lock.json /overleaf/
COPY services/web/package.json /overleaf/services/web/
COPY libraries/ /overleaf/libraries/

ENV CYPRESS_INSTALL_BINARY=0

RUN cd /overleaf && npm ci --quiet


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
