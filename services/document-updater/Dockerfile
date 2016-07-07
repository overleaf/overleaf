FROM ubuntu

COPY ./test/acceptance/docker-entrypoint.sh /entrypoint.sh

RUN apt-get update && apt-get upgrade
RUN apt-get install build-essential redis-server mongodb-server nodejs npm
RUN ln -s /usr/bin/nodejs /usr/bin/node

RUN mkdir /document-updater
VOLUME /document-updater

ENTRYPOINT /entrypoint.sh