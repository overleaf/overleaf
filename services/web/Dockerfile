# This file was auto-generated, do not edit it directly.
# Instead run internal$ services/web/build_scripts

FROM node:22.18.0 AS base

WORKDIR /overleaf/services/web

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

# Add intermediate certificate for prism.optica.org
COPY services/web/certs/DigiCertGlobalG2TLSRSASHA2562020CA1-1.crt.pem /usr/local/share/ca-certificates/DigiCertGlobalG2TLSRSASHA2562020CA1-1.crt
RUN update-ca-certificates

# the deps image is used for caching npm ci
FROM base AS deps-prod

COPY package.json package-lock.json /overleaf/
COPY libraries/access-token-encryptor/package.json /overleaf/libraries/access-token-encryptor/package.json
COPY libraries/eslint-plugin/package.json /overleaf/libraries/eslint-plugin/package.json
COPY libraries/fetch-utils/package.json /overleaf/libraries/fetch-utils/package.json
COPY libraries/logger/package.json /overleaf/libraries/logger/package.json
COPY libraries/metrics/package.json /overleaf/libraries/metrics/package.json
COPY libraries/mongo-utils/package.json /overleaf/libraries/mongo-utils/package.json
COPY libraries/o-error/package.json /overleaf/libraries/o-error/package.json
COPY libraries/object-persistor/package.json /overleaf/libraries/object-persistor/package.json
COPY libraries/overleaf-editor-core/package.json /overleaf/libraries/overleaf-editor-core/package.json
COPY libraries/promise-utils/package.json /overleaf/libraries/promise-utils/package.json
COPY libraries/ranges-tracker/package.json /overleaf/libraries/ranges-tracker/package.json
COPY libraries/redis-wrapper/package.json /overleaf/libraries/redis-wrapper/package.json
COPY libraries/settings/package.json /overleaf/libraries/settings/package.json
COPY libraries/stream-utils/package.json /overleaf/libraries/stream-utils/package.json
COPY libraries/validation-tools/package.json /overleaf/libraries/validation-tools/package.json
COPY services/web/package.json /overleaf/services/web/package.json
COPY tools/migrations/package.json /overleaf/tools/migrations/package.json
COPY patches/ /overleaf/patches/

RUN cd /overleaf && NODE_ENV=production npm ci --quiet

FROM deps-prod AS deps

ENV CYPRESS_INSTALL_BINARY=0

COPY tsconfig.backend.json /overleaf/
RUN cd /overleaf && npm install


# the dev is suitable for running tests
FROM deps AS dev

ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=$SENTRY_RELEASE
COPY libraries/access-token-encryptor/ /overleaf/libraries/access-token-encryptor/
COPY libraries/eslint-plugin/ /overleaf/libraries/eslint-plugin/
COPY libraries/fetch-utils/ /overleaf/libraries/fetch-utils/
COPY libraries/logger/ /overleaf/libraries/logger/
COPY libraries/metrics/ /overleaf/libraries/metrics/
COPY libraries/mongo-utils/ /overleaf/libraries/mongo-utils/
COPY libraries/o-error/ /overleaf/libraries/o-error/
COPY libraries/object-persistor/ /overleaf/libraries/object-persistor/
COPY libraries/overleaf-editor-core/ /overleaf/libraries/overleaf-editor-core/
COPY libraries/promise-utils/ /overleaf/libraries/promise-utils/
COPY libraries/ranges-tracker/ /overleaf/libraries/ranges-tracker/
COPY libraries/redis-wrapper/ /overleaf/libraries/redis-wrapper/
COPY libraries/settings/ /overleaf/libraries/settings/
COPY libraries/stream-utils/ /overleaf/libraries/stream-utils/
COPY libraries/validation-tools/ /overleaf/libraries/validation-tools/
COPY services/web/ /overleaf/services/web/
COPY tools/migrations/ /overleaf/tools/migrations/

# Build the latex parser
RUN cd /overleaf/services/web && npm run 'lezer-latex:generate'

USER node


# the webpack image has deps+src+webpack artifacts
FROM dev AS webpack
USER root
RUN OVERLEAF_CONFIG=/overleaf/services/web/config/settings.webpack.js nice npm run webpack:production


# intermediate image for removing source maps ahead of copying into final production image
FROM webpack AS webpack-no-sourcemaps
RUN nice find /overleaf/services/web/public -name '*.js.map' -delete


# copy source code and precompile pug images
FROM deps-prod AS pug
COPY libraries/access-token-encryptor/ /overleaf/libraries/access-token-encryptor/
COPY libraries/eslint-plugin/ /overleaf/libraries/eslint-plugin/
COPY libraries/fetch-utils/ /overleaf/libraries/fetch-utils/
COPY libraries/logger/ /overleaf/libraries/logger/
COPY libraries/metrics/ /overleaf/libraries/metrics/
COPY libraries/mongo-utils/ /overleaf/libraries/mongo-utils/
COPY libraries/o-error/ /overleaf/libraries/o-error/
COPY libraries/object-persistor/ /overleaf/libraries/object-persistor/
COPY libraries/overleaf-editor-core/ /overleaf/libraries/overleaf-editor-core/
COPY libraries/promise-utils/ /overleaf/libraries/promise-utils/
COPY libraries/ranges-tracker/ /overleaf/libraries/ranges-tracker/
COPY libraries/redis-wrapper/ /overleaf/libraries/redis-wrapper/
COPY libraries/settings/ /overleaf/libraries/settings/
COPY libraries/stream-utils/ /overleaf/libraries/stream-utils/
COPY libraries/validation-tools/ /overleaf/libraries/validation-tools/
COPY services/web/ /overleaf/services/web/
COPY tools/migrations/ /overleaf/tools/migrations/

# Omit Server Pro/CE specific scripts from SaaS image
RUN rm /overleaf/services/web/modules/server-ce-scripts -rf
RUN OVERLEAF_CONFIG=/overleaf/services/web/config/settings.overrides.saas.js nice npm run precompile-pug


# the web image with only production dependencies but no webpack production build, for development
FROM pug AS app-only
USER node
CMD ["node", "--expose-gc", "app.mjs"]


# the final production image, with webpack production build but without source maps
FROM pug AS app
ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=$SENTRY_RELEASE
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/DigiCertGlobalG2TLSRSASHA2562020CA1-1.crt
COPY --from=webpack-no-sourcemaps /overleaf/services/web/public /overleaf/services/web/public
USER node
CMD ["node", "--expose-gc", "app.mjs"]
