# This file was auto-generated, do not edit it directly.
# Instead run bin/update_build_scripts from
# https://github.com/overleaf/internal/

FROM node:16.17.1 as base

WORKDIR /overleaf/services/real-time

# Google Cloud Storage needs a writable $HOME/.config for resumable uploads
# (see https://googleapis.dev/nodejs/storage/latest/File.html#createWriteStream)
RUN mkdir /home/node/.config && chown node:node /home/node/.config

FROM base as app

COPY package.json package-lock.json /overleaf/
COPY services/real-time/package.json /overleaf/services/real-time/
COPY libraries/ /overleaf/libraries/

RUN cd /overleaf && npm ci --quiet

COPY services/real-time/ /overleaf/services/real-time/

FROM app
USER node

CMD ["node", "--expose-gc", "app.js"]
