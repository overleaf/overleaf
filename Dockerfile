# Sharelatex Community Edition (sharelatex/sharelatex)

FROM sharelatex/sharelatex-base:latest

ENV baseDir .

# Install sharelatex settings file
ADD ${baseDir}/settings.coffee /etc/sharelatex/settings.coffee
ENV SHARELATEX_CONFIG /etc/sharelatex/settings.coffee

ADD ${baseDir}/runit            /etc/service

RUN rm /etc/nginx/sites-enabled/default
ADD ${baseDir}/nginx/nginx.conf /etc/nginx/nginx.conf
ADD ${baseDir}/nginx/sharelatex.conf /etc/nginx/sites-enabled/sharelatex.conf

ADD ${baseDir}/logrotate/sharelatex /etc/logrotate.d/sharelatex

COPY ${baseDir}/init_scripts/  /etc/my_init.d/

# Install ShareLaTeX
RUN git clone https://github.com/sharelatex/sharelatex.git /var/www/sharelatex

ADD ${baseDir}/services.js /var/www/sharelatex/config/services.js
ADD ${baseDir}/package.json /var/www/package.json
ADD ${baseDir}/git-revision.js /var/www/git-revision.js
RUN cd /var/www && npm install

RUN cd /var/www/sharelatex; \
	npm install; \
	grunt install; \
	bash -c 'source ./bin/install-services'; \
	cd web; \
	npm install; \
	npm install bcrypt; \
	cd modules; \
	git clone https://github.com/sharelatex/launchpad-web-module.git launchpad; \
	grunt compile;

RUN cd /var/www && node git-revision > revisions.txt
	
# Minify js assets
RUN cd /var/www/sharelatex/web; \
	grunt compile:minify;

RUN cd /var/www/sharelatex/clsi; \
	grunt compile:bin; \
	chown -R www-data:www-data /var/www/sharelatex;

EXPOSE 80

WORKDIR /

ENTRYPOINT ["/sbin/my_init"]

