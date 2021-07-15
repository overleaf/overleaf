# This file was auto-generated, do not edit it directly.
# Instead run bin/update_build_scripts from
# https://github.com/sharelatex/sharelatex-dev-environment

FROM node:12.22.3 as base

WORKDIR /app
COPY install_deps.sh /app
RUN chmod 0755 ./install_deps.sh && ./install_deps.sh

FROM base as app

#wildcard as some files may not be in all repos
COPY package*.json npm-shrink*.json /app/

RUN npm ci --quiet

COPY . /app

FROM base

COPY --from=app /app /app
RUN mkdir -p uploads user_files template_files \
&&  chown node:node uploads user_files template_files
USER node

CMD ["node", "--expose-gc", "app.js"]
