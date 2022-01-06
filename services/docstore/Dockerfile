# This file was auto-generated, do not edit it directly.
# Instead run bin/update_build_scripts from
# https://github.com/sharelatex/sharelatex-dev-environment

FROM node:14.18.1 as base

WORKDIR /overleaf/services/docstore

FROM base as app

COPY services/docstore/package*.json /overleaf/services/docstore/

RUN npm ci --quiet

COPY services/docstore /overleaf/services/docstore

FROM app
USER node

CMD ["node", "--expose-gc", "app.js"]
