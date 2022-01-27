# This file was auto-generated, do not edit it directly.
# Instead run bin/update_build_scripts from
# https://github.com/sharelatex/sharelatex-dev-environment

FROM node:14.18.3 as base

WORKDIR /overleaf/services/track-changes

FROM base as app

COPY services/track-changes/package*.json /overleaf/services/track-changes/

RUN npm ci --quiet

COPY services/track-changes /overleaf/services/track-changes

FROM app
USER node

CMD ["node", "--expose-gc", "app.js"]
