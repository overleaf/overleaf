# This file was auto-generated, do not edit it directly.
# Instead run bin/update_build_scripts from
# https://github.com/overleaf/internal/

FROM node:16.17.1 as base

WORKDIR /overleaf/services/track-changes

# Google Cloud Storage needs a writable $HOME/.config for resumable uploads
# (see https://googleapis.dev/nodejs/storage/latest/File.html#createWriteStream)
RUN mkdir /home/node/.config && chown node:node /home/node/.config

FROM base as app

COPY package.json package-lock.json /overleaf/
COPY services/track-changes/package.json /overleaf/services/track-changes/
COPY libraries/ /overleaf/libraries/
COPY patches/ /overleaf/patches/

RUN cd /overleaf && npm ci --quiet

COPY services/track-changes/ /overleaf/services/track-changes/

FROM app
USER node

CMD ["node", "--expose-gc", "app.js"]
