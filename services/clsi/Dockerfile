FROM node:6.13.0

COPY ./ /app

WORKDIR /app


RUN npm install

RUN [ -e ./install_deps.sh ] && ./install_deps.sh

RUN npm run compile

ENV NODE_ENV production

CMD ["node","/app/app.js"]
