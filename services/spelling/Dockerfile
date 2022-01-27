# This file was auto-generated, do not edit it directly.
# Instead run bin/update_build_scripts from
# https://github.com/sharelatex/sharelatex-dev-environment

FROM node:14.18.3 as base

WORKDIR /overleaf/services/spelling
COPY services/spelling/install_deps.sh /overleaf/services/spelling/
RUN chmod 0755 ./install_deps.sh && ./install_deps.sh

FROM base as app

COPY services/spelling/package*.json /overleaf/services/spelling/

RUN npm ci --quiet

COPY services/spelling /overleaf/services/spelling

FROM app
RUN mkdir -p cache \
&&  chown node:node cache
USER node

CMD ["node", "--expose-gc", "app.js"]
