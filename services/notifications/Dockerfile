# This file was auto-generated, do not edit it directly.
# Instead run bin/update_build_scripts from
# https://github.com/sharelatex/sharelatex-dev-environment

FROM node:14.18.3 as base

WORKDIR /overleaf/services/notifications

FROM base as app

COPY services/notifications/package*.json /overleaf/services/notifications/

RUN npm ci --quiet

COPY services/notifications /overleaf/services/notifications

FROM app
USER node

CMD ["node", "--expose-gc", "app.js"]
