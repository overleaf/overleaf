FROM node:6.9.5

RUN wget -qO- https://get.docker.com/ | sh

# ---- Copy Files/Build ----
WORKDIR /app
COPY ./ /app
# Build react/vue/angular bundle static files
# RUN npm run build
RUN npm install

RUN npm run compile

EXPOSE 3013

ENV SHARELATEX_CONFIG /app/config/settings.production.coffee
ENV NODE_ENV production

CMD ["node","/app/app.js"]
