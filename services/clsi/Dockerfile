FROM node:6.13.0 as app

COPY ./ /app

WORKDIR /app

RUN npm install


RUN npm run compile:all

FROM node:6.13.0

COPY --from=app /app /app

WORKDIR /app
RUN ./install_deps.sh
ENTRYPOINT ["/bin/sh", "entrypoint.sh"]

CMD ["node","app.js"]
