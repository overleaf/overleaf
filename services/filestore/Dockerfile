FROM node:6.9.5 as app

WORKDIR /app

COPY package.json package-lock.json /app/

RUN npm install --quiet

COPY . /app

RUN npm run compile:all

FROM node:6.9.5

COPY --from=app /app /app

WORKDIR /app
RUN ./install_deps.sh
USER node

CMD ["node","app.js"]
