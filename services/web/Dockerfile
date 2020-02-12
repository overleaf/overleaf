FROM node:10.19.0 as base

WORKDIR /app

# install_deps changes app files and installs npm packages
# as such it has to run at a later stage

FROM base as app

#wildcard as some files may not be in all repos
COPY package.json package-lock.json /app/

RUN npm install --quiet


COPY . /app

FROM base

COPY --from=app /app /app

WORKDIR /app
RUN chmod 0755 ./install_deps.sh && ./install_deps.sh
USER node

CMD ["node", "--expose-gc", "app.js"]
