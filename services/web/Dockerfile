FROM gcr.io/overleaf-ops/node:10.19.0 as app

WORKDIR /app

#wildcard as some files may not be in all repos
COPY package.json package-lock.json /app/

RUN npm install --quiet


COPY . /app

FROM gcr.io/overleaf-ops/node:10.19.0

COPY --from=app /app /app

WORKDIR /app
RUN chmod 0755 ./install_deps.sh && ./install_deps.sh
USER node

CMD ["node", "--expose-gc", "app.js"]
