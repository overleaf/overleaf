FROM ubuntu

COPY ./test/acceptance/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN apt-get update && apt-get upgrade -y
RUN apt-get install -y build-essential redis-server mongodb-server nodejs npm
RUN ln -s /usr/bin/nodejs /usr/bin/node
RUN npm install -g grunt-cli

RUN mkdir /document-updater
VOLUME /document-updater

ENTRYPOINT /entrypoint.sh