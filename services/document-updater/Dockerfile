# This file was auto-generated, do not edit it directly.
# Instead run bin/update_build_scripts from
# https://github.com/sharelatex/sharelatex-dev-environment

FROM node:14.18.1 as base

WORKDIR /overleaf/services/document-updater

FROM base as app

COPY services/document-updater/package*.json /overleaf/services/document-updater/

RUN npm ci --quiet

COPY services/document-updater /overleaf/services/document-updater

FROM app
USER node

CMD ["node", "--expose-gc", "app.js"]
