# This file was auto-generated, do not edit it directly.
# Instead run bin/update_build_scripts from
# https://github.com/overleaf/internal/

FROM node:24.14.1 AS base

# Corepack setup, shared between all the images.
ENV PATH="/overleaf/node_modules/.bin:$PATH"
ENV COREPACK_HOME=/opt/corepack
RUN corepack enable && corepack install -g yarn@4.14.1
ENV COREPACK_ENABLE_NETWORK=0

WORKDIR /overleaf/services/chat

# Google Cloud Storage needs a writable $HOME/.config for resumable uploads
# (see https://googleapis.dev/nodejs/storage/latest/File.html#createWriteStream)
RUN mkdir /home/node/.config && chown node:node /home/node/.config

FROM base AS app

COPY package.json yarn.lock .yarnrc.yml /overleaf/
COPY libraries/eslint-plugin/package.json /overleaf/libraries/eslint-plugin/package.json
COPY libraries/fetch-utils/package.json /overleaf/libraries/fetch-utils/package.json
COPY libraries/logger/package.json /overleaf/libraries/logger/package.json
COPY libraries/metrics/package.json /overleaf/libraries/metrics/package.json
COPY libraries/mongo-utils/package.json /overleaf/libraries/mongo-utils/package.json
COPY libraries/o-error/package.json /overleaf/libraries/o-error/package.json
COPY libraries/promise-utils/package.json /overleaf/libraries/promise-utils/package.json
COPY libraries/settings/package.json /overleaf/libraries/settings/package.json
COPY services/chat/package.json /overleaf/services/chat/package.json
COPY tools/migrations/package.json /overleaf/tools/migrations/package.json
COPY .yarn/patches/ /overleaf/.yarn/patches/
COPY tools/migrations/ /overleaf/tools/migrations/

RUN cd /overleaf && yarn workspaces focus @overleaf/chat overleaf
COPY libraries/eslint-plugin/ /overleaf/libraries/eslint-plugin/
COPY libraries/fetch-utils/ /overleaf/libraries/fetch-utils/
COPY libraries/logger/ /overleaf/libraries/logger/
COPY libraries/metrics/ /overleaf/libraries/metrics/
COPY libraries/mongo-utils/ /overleaf/libraries/mongo-utils/
COPY libraries/o-error/ /overleaf/libraries/o-error/
COPY libraries/promise-utils/ /overleaf/libraries/promise-utils/
COPY libraries/settings/ /overleaf/libraries/settings/
COPY services/chat/ /overleaf/services/chat/
COPY tools/migrations/ /overleaf/tools/migrations/

FROM app
USER node

CMD ["node", "--expose-gc", "app.js"]
