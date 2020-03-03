FROM node:10.19.0 as base

WORKDIR /app

# install_deps changes app files and installs npm packages
# as such it has to run at a later stage

FROM base as app

COPY package.json package-lock.json /app/

RUN npm install --quiet

COPY . /app

# Set environment variables for Sentry
ARG SENTRY_RELEASE
ARG BRANCH_NAME
ENV SENTRY_RELEASE=$SENTRY_RELEASE
ENV BRANCH_NAME=$BRANCH_NAME

RUN chmod 0755 ./install_deps.sh && ./install_deps.sh

FROM base

COPY --from=app /app /app

WORKDIR /app

RUN mkdir -p /app/data/dumpFolder && \
  mkdir -p /app/data/logs && \
  mkdir -p /app/data/pdf && \
  mkdir -p /app/data/uploads && \
  mkdir -p /app/data/zippedProjects && \
  chmod -R 0755 /app/data/ && \
  chown -R node:node /app/data/

USER node

CMD ["node", "--expose-gc", "app.js"]
