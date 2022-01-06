# This file was auto-generated, do not edit it directly.
# Instead run bin/update_build_scripts from
# https://github.com/sharelatex/sharelatex-dev-environment

FROM node:14.18.1 as base

WORKDIR /overleaf/services/filestore
COPY services/filestore/install_deps.sh /overleaf/services/filestore/
RUN chmod 0755 ./install_deps.sh && ./install_deps.sh

FROM base as app

COPY services/filestore/package*.json /overleaf/services/filestore/

RUN npm ci --quiet

COPY services/filestore /overleaf/services/filestore

FROM app
RUN mkdir -p uploads user_files template_files \
&&  chown node:node uploads user_files template_files
USER node

CMD ["node", "--expose-gc", "app.js"]
