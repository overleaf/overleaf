FROM node:8.9.1

WORKDIR /app

COPY package.json /app/

RUN npm install --quiet


COPY . /app
RUN npm run compile:all

FROM node:8.9.1

COPY --from=0 /app /app
# All app and node_modules will be owned by root.
# The app will run as the 'app' user, and so not have write permissions
# on any files it doesn't need.
RUN useradd --user-group --create-home --home-dir /app --shell /bin/false app
RUN chown app:app /app/uploads

USER app
WORKDIR /app

EXPOSE 3009

CMD ["node","app.js"]
