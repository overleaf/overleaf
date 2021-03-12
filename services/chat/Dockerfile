# This file was auto-generated, do not edit it directly.
# Instead run bin/update_build_scripts from
# https://github.com/sharelatex/sharelatex-dev-environment

FROM node:12.21.0 as base

WORKDIR /app

FROM base as app

#wildcard as some files may not be in all repos
COPY package*.json npm-shrink*.json /app/

RUN npm ci --quiet

COPY . /app

FROM base

COPY --from=app /app /app
USER node

CMD ["node", "--expose-gc", "app.js"]
