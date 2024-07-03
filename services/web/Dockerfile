# the base image is suitable for running web with /overleaf/services/web bind
# mounted
FROM node:18.20.2 as base

WORKDIR /overleaf/services/web

# install_deps changes app files and installs npm packages
# as such it has to run at a later stage

# Google Cloud Storage needs a writable $HOME/.config for resumable uploads
# (see https://googleapis.dev/nodejs/storage/latest/File.html#createWriteStream)
RUN mkdir /home/node/.config && chown node:node /home/node/.config

RUN mkdir -p /overleaf/services/web/data/dumpFolder \
    &&  mkdir -p /overleaf/services/web/data/logs \
    &&  mkdir -p /overleaf/services/web/data/pdf \
    &&  mkdir -p /overleaf/services/web/data/uploads \
    &&  mkdir -p /overleaf/services/web/data/zippedProjects \
    &&  mkdir -p /overleaf/services/web/data/projectHistories \
    &&  chmod -R 0755 /overleaf/services/web/data \
    &&  chown -R node:node /overleaf/services/web/data


# the deps image is used for caching npm ci
FROM base as deps-prod

COPY package.json package-lock.json /overleaf/
COPY services/web/package.json /overleaf/services/web/
COPY libraries/ /overleaf/libraries/
COPY patches/ /overleaf/patches/

RUN cd /overleaf && NODE_ENV=production npm ci --quiet

FROM deps-prod as deps

ENV CYPRESS_INSTALL_BINARY=0

COPY tsconfig.backend.json /overleaf/
RUN cd /overleaf && npm install


# the dev is suitable for running tests
FROM deps as dev

ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=$SENTRY_RELEASE
COPY services/web /overleaf/services/web

# Build the latex parser
RUN cd /overleaf/services/web && npm run 'lezer-latex:generate'

USER node


# the webpack image has deps+src+webpack artifacts
FROM dev as webpack
USER root
RUN chmod 0755 ./install_deps.sh && ./install_deps.sh


# intermediate image for removing source maps ahead of copying into final production image
FROM webpack as webpack-no-sourcemaps
RUN find /overleaf/services/web/public -name '*.js.map' -delete


# copy source code and precompile pug images
FROM deps-prod as pug
COPY services/web /overleaf/services/web
# Omit Server Pro/CE specific scripts from SaaS image
RUN rm /overleaf/services/web/modules/server-ce-scripts -rf
RUN OVERLEAF_CONFIG=/overleaf/services/web/config/settings.overrides.saas.js npm run precompile-pug


# the web image with only production dependencies but no webpack production build, for development
FROM pug as app-only
USER node
CMD ["node", "--expose-gc", "app.js"]


# the final production image, with webpack production build but without source maps
FROM pug as app
ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=$SENTRY_RELEASE
COPY --from=webpack-no-sourcemaps /overleaf/services/web/public /overleaf/services/web/public
USER node
CMD ["node", "--expose-gc", "app.js"]
