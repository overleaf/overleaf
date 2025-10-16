# This file was auto-generated, do not edit it directly.
# Instead run bin/update_build_scripts from
# https://github.com/overleaf/internal/

FROM node:22.18.0 AS base

WORKDIR /overleaf/services/document-updater

# Google Cloud Storage needs a writable $HOME/.config for resumable uploads
# (see https://googleapis.dev/nodejs/storage/latest/File.html#createWriteStream)
RUN mkdir /home/node/.config && chown node:node /home/node/.config

FROM base AS app

COPY package.json package-lock.json /overleaf/
COPY libraries/fetch-utils/package.json /overleaf/libraries/fetch-utils/package.json
COPY libraries/logger/package.json /overleaf/libraries/logger/package.json
COPY libraries/metrics/package.json /overleaf/libraries/metrics/package.json
COPY libraries/mongo-utils/package.json /overleaf/libraries/mongo-utils/package.json
COPY libraries/o-error/package.json /overleaf/libraries/o-error/package.json
COPY libraries/overleaf-editor-core/package.json /overleaf/libraries/overleaf-editor-core/package.json
COPY libraries/promise-utils/package.json /overleaf/libraries/promise-utils/package.json
COPY libraries/ranges-tracker/package.json /overleaf/libraries/ranges-tracker/package.json
COPY libraries/redis-wrapper/package.json /overleaf/libraries/redis-wrapper/package.json
COPY libraries/settings/package.json /overleaf/libraries/settings/package.json
COPY services/document-updater/package.json /overleaf/services/document-updater/package.json
COPY tools/migrations/package.json /overleaf/tools/migrations/package.json
COPY patches/ /overleaf/patches/
COPY tools/migrations/ /overleaf/tools/migrations/

RUN cd /overleaf && npm ci --quiet
COPY libraries/fetch-utils/ /overleaf/libraries/fetch-utils/
COPY libraries/logger/ /overleaf/libraries/logger/
COPY libraries/metrics/ /overleaf/libraries/metrics/
COPY libraries/mongo-utils/ /overleaf/libraries/mongo-utils/
COPY libraries/o-error/ /overleaf/libraries/o-error/
COPY libraries/overleaf-editor-core/ /overleaf/libraries/overleaf-editor-core/
COPY libraries/promise-utils/ /overleaf/libraries/promise-utils/
COPY libraries/ranges-tracker/ /overleaf/libraries/ranges-tracker/
COPY libraries/redis-wrapper/ /overleaf/libraries/redis-wrapper/
COPY libraries/settings/ /overleaf/libraries/settings/
COPY services/document-updater/ /overleaf/services/document-updater/
COPY tools/migrations/ /overleaf/tools/migrations/

FROM app
USER node

CMD ["node", "--expose-gc", "app.js"]
