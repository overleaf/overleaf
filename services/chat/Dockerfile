# This file was auto-generated, do not edit it directly.
# Instead run bin/update_build_scripts from
# https://github.com/sharelatex/sharelatex-dev-environment

FROM node:14.18.1 as base

WORKDIR /overleaf/services/chat

FROM base as app

COPY services/chat/package*.json /overleaf/services/chat/

RUN npm ci --quiet

COPY services/chat /overleaf/services/chat

FROM app
USER node

CMD ["node", "--expose-gc", "app.js"]
