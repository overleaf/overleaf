FROM node:6.9.5

RUN wget -qO- https://get.docker.com/ | sh

run apt-get install poppler-utils vim ghostscript --yes

# run git build-essential --yes
# RUN git clone https://github.com/netblue30/firejail.git
# RUN cd firejail && ./configure && make && make install-strip
# run mkdir /data

COPY ./ /app

WORKDIR /app

RUN npm install

RUN npm run compile

ENV SHARELATEX_CONFIG /app/config/settings.production.coffee
ENV NODE_ENV production

CMD ["node","/app/app.js"]
