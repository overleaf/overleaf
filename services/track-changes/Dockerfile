# This file was auto-generated, do not edit it directly.
# Instead run bin/update_build_scripts from
# https://github.com/sharelatex/sharelatex-dev-environment
# Version: 1.3.4

FROM gcr.io/overleaf-ops/node:10.18.1 as app

WORKDIR /app

#wildcard as some files may not be in all repos
COPY package*.json npm-shrink*.json /app/

RUN npm install --quiet

COPY . /app


RUN npm run compile:all

FROM gcr.io/overleaf-ops/node:10.18.1

COPY --from=app /app /app

WORKDIR /app
USER node

CMD ["node", "--expose-gc", "app.js"]
