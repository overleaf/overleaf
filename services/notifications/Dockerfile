# This file was auto-generated, do not edit it directly.
# Instead run bin/update_build_scripts from
# https://github.com/overleaf/internal/

FROM node:16.17.1 as base

WORKDIR /overleaf/services/notifications

# Google Cloud Storage needs a writable $HOME/.config for resumable uploads
# (see https://googleapis.dev/nodejs/storage/latest/File.html#createWriteStream)
RUN mkdir /home/node/.config && chown node:node /home/node/.config

FROM base as app

COPY package.json package-lock.json /overleaf/
COPY services/notifications/package.json /overleaf/services/notifications/
COPY libraries/ /overleaf/libraries/

RUN cd /overleaf && npm ci --quiet

COPY services/notifications/ /overleaf/services/notifications/

FROM app
USER node

CMD ["node", "--expose-gc", "app.js"]
