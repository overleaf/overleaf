FROM node:10.15.0 as app

WORKDIR /app

#wildcard as some files may not be in all repos
COPY package*.json npm-shrink*.json /app/

RUN npm install --quiet

COPY . /app


RUN npm run compile:all

FROM node:10.15.0

COPY --from=app /app /app

WORKDIR /app
RUN chmod 0755 ./install_deps.sh && ./install_deps.sh
ENTRYPOINT ["/bin/sh", "entrypoint.sh"]

CMD ["node", "--expose-gc", "app.js"]
