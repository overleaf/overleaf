FROM phusion/baseimage:0.9.16

RUN curl -sL https://deb.nodesource.com/setup | sudo bash -
RUN apt-get install -y build-essential nodejs

RUN npm install -g grunt-cli

# Set up sharelatex user and home directory
RUN adduser --system --group --home /var/www/sharelatex --no-create-home sharelatex; \
	mkdir -p /var/lib/sharelatex; \
	chown sharelatex:sharelatex /var/lib/sharelatex; \
	mkdir -p /var/log/sharelatex; \
	chown sharelatex:sharelatex /var/log/sharelatex;

RUN apt-get install -y git python
RUN git clone https://github.com/sharelatex/sharelatex.git /var/www/sharelatex

# zlib1g-dev is needed to compile the synctex binaries in the CLSI during `grunt install`.
RUN apt-get install -y zlib1g-dev

RUN cd /var/www/sharelatex; \
	npm install; \
	grunt install;
	
# Minify js assets
RUN cd /var/www/sharelatex/web; \
	grunt compile:minify;
	
RUN apt-get install -y nginx;
RUN rm /etc/nginx/sites-enabled/default
ADD nginx/nginx.conf /etc/nginx/nginx.conf
ADD nginx/sharelatex.conf /etc/nginx/sites-enabled/sharelatex.conf

RUN mkdir /etc/service/nginx
ADD runit/nginx.sh /etc/service/nginx/run
		
RUN mkdir /etc/service/chat-sharelatex; \
	mkdir /etc/service/clsi-sharelatex; \
	mkdir /etc/service/docstore-sharelatex; \
	mkdir /etc/service/document-updater-sharelatex; \
	mkdir /etc/service/filestore-sharelatex; \
	mkdir /etc/service/real-time-sharelatex; \
	mkdir /etc/service/spelling-sharelatex; \
	mkdir /etc/service/tags-sharelatex; \
	mkdir /etc/service/track-changes-sharelatex; \
	mkdir /etc/service/web-sharelatex; 

ADD runit/chat-sharelatex.sh             /etc/service/chat-sharelatex/run
ADD runit/clsi-sharelatex.sh             /etc/service/clsi-sharelatex/run
ADD runit/docstore-sharelatex.sh         /etc/service/docstore-sharelatex/run
ADD runit/document-updater-sharelatex.sh /etc/service/document-updater-sharelatex/run
ADD runit/filestore-sharelatex.sh        /etc/service/filestore-sharelatex/run
ADD runit/real-time-sharelatex.sh        /etc/service/real-time-sharelatex/run
ADD runit/spelling-sharelatex.sh         /etc/service/spelling-sharelatex/run
ADD runit/tags-sharelatex.sh             /etc/service/tags-sharelatex/run
ADD runit/track-changes-sharelatex.sh    /etc/service/track-changes-sharelatex/run
ADD runit/web-sharelatex.sh              /etc/service/web-sharelatex/run

RUN mkdir /etc/sharelatex
ADD settings.coffee /etc/sharelatex/settings.coffee

# TexLive
RUN apt-get install -y wget
RUN wget http://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz; \
	mkdir /install-tl-unx; \
	tar -xvf install-tl-unx.tar.gz -C /install-tl-unx --strip-components=1

RUN echo "selected_scheme scheme-basic" >> /install-tl-unx/texlive.profile; \
	/install-tl-unx/install-tl -profile /install-tl-unx/texlive.profile
RUN rm -r /install-tl-unx; \
	rm install-tl-unx.tar.gz

ENV PATH /usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/texlive/2014/bin/x86_64-linux/
RUN tlmgr install latexmk

# Aspell
RUN apt-get install -y aspell aspell-en aspell-af aspell-am aspell-ar aspell-ar-large aspell-bg aspell-bn aspell-br aspell-ca aspell-cs aspell-cy aspell-da aspell-de aspell-de-alt aspell-el aspell-eo aspell-es aspell-et aspell-eu-es aspell-fa aspell-fo aspell-fr aspell-ga aspell-gl-minimos aspell-gu aspell-he aspell-hi aspell-hr aspell-hsb aspell-hu aspell-hy aspell-id aspell-is aspell-it aspell-kk aspell-kn aspell-ku aspell-lt aspell-lv aspell-ml aspell-mr aspell-nl aspell-no aspell-nr aspell-ns aspell-or aspell-pa aspell-pl aspell-pt-br aspell-ro aspell-ru aspell-sk aspell-sl aspell-ss aspell-st aspell-sv aspell-ta aspell-te aspell-tl aspell-tn aspell-ts aspell-uk aspell-uz aspell-xh aspell-zu 

# phusion/baseimage init script
ADD 00_regen_sharelatex_secrets.sh  /etc/my_init.d/00_regen_sharelatex_secrets.sh
ADD 00_make_sharelatex_data_dirs.sh /etc/my_init.d/00_make_sharelatex_data_dirs.sh
ADD 00_set_docker_host_ipaddress.sh /etc/my_init.d/00_set_docker_host_ipaddress.sh

EXPOSE 80

ENTRYPOINT ["/sbin/my_init"]