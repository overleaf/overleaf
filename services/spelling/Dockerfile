# This file was auto-generated, do not edit it directly.
# Instead run bin/update_build_scripts from
# https://github.com/overleaf/internal/

FROM node:16.17.1 as base

WORKDIR /overleaf/services/spelling
COPY services/spelling/install_deps.sh /overleaf/services/spelling/
RUN chmod 0755 ./install_deps.sh && ./install_deps.sh

# Google Cloud Storage needs a writable $HOME/.config for resumable uploads
# (see https://googleapis.dev/nodejs/storage/latest/File.html#createWriteStream)
RUN mkdir /home/node/.config && chown node:node /home/node/.config

FROM base as app

COPY package.json package-lock.json /overleaf/
COPY services/spelling/package.json /overleaf/services/spelling/
COPY libraries/ /overleaf/libraries/
COPY patches/ /overleaf/patches/

RUN cd /overleaf && npm ci --quiet

COPY services/spelling/ /overleaf/services/spelling/

FROM app
RUN mkdir -p cache \
&&  chown node:node cache
USER node

CMD ["node", "--expose-gc", "app.js"]
