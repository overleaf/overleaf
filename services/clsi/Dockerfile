FROM node:6.13.0 as app

COPY ./ /app

WORKDIR /app

RUN npm install

RUN npm run compile:all

FROM node:6.13.0

COPY --from=app /app /app

WORKDIR /app

RUN useradd --user-group --create-home --home-dir /app --shell /bin/false app

RUN [ -e ./install_deps.sh ] && ./install_deps.sh

ENTRYPOINT ["/bin/sh", "entrypoint.sh"]
CMD ["node","app.js"]
