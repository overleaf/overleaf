# ---------------------------------------------
# Overleaf Community Edition (overleaf/overleaf)
# ---------------------------------------------

FROM sharelatex/sharelatex-base:latest

ENV baseDir .

# Add required source files
# -------------------------
ADD ${baseDir}/bin /var/www/sharelatex/bin
ADD ${baseDir}/doc /var/www/sharelatex/doc
ADD ${baseDir}/migrations /var/www/sharelatex/migrations
ADD ${baseDir}/tasks /var/www/sharelatex/tasks
ADD ${baseDir}/Gruntfile.coffee /var/www/sharelatex/Gruntfile.coffee
ADD ${baseDir}/package.json /var/www/sharelatex/package.json
ADD ${baseDir}/npm-shrinkwrap.json /var/www/sharelatex/npm-shrinkwrap.json
ADD ${baseDir}/services.js /var/www/sharelatex/config/services.js


# Install app settings files
# --------------------------
ADD ${baseDir}/settings.coffee /etc/sharelatex/settings.coffee
ENV SHARELATEX_CONFIG /etc/sharelatex/settings.coffee


# Install dependencies needed to run configuration scripts
# --------------------------------------------------------
ADD ${baseDir}/package.json /var/www/package.json
ADD ${baseDir}/git-revision.sh /var/www/git-revision.sh
RUN cd /var/www && npm install


# Replace overleaf/config/services.js with the list of available
# services in Overleaf Community Edition
# --------------------------------------------------------------
ADD ${baseDir}/services.js /var/www/sharelatex/config/services.js


# Checkout services
# -----------------
RUN cd /var/www/sharelatex && \
	npm install && grunt install;


# install and compile services
# ----------------------------
RUN bash -c 'cd /var/www/sharelatex && source ./bin/install-services'
RUN bash -c 'cd /var/www/sharelatex && source ./bin/compile-services'


# Links CLSI sycntex to its default location
# ------------------------------------------
RUN ln -s /var/www/sharelatex/clsi/bin/synctex /opt/synctex


# Copy runit service startup scripts to its location
# --------------------------------------------------
ADD ${baseDir}/runit /etc/service


# Configure nginx
# ---------------
RUN rm /etc/nginx/sites-enabled/default
ADD ${baseDir}/nginx/nginx.conf /etc/nginx/nginx.conf
ADD ${baseDir}/nginx/sharelatex.conf /etc/nginx/sites-enabled/sharelatex.conf


# Configure log rotation
# ----------------------
ADD ${baseDir}/logrotate/sharelatex /etc/logrotate.d/sharelatex


# Copy Phusion Image startup scripts to its location
# --------------------------------------------------
COPY ${baseDir}/init_scripts/ /etc/my_init.d/


# Stores the version installed for each service
# ---------------------------------------------
RUN cd /var/www && ./git-revision.sh > revisions.txt


# Set Environment Variables
# --------------------------------
ENV WEB_API_USER "sharelatex"

ENV SHARELATEX_APP_NAME "Overleaf Community Edition"


EXPOSE 80

WORKDIR /

ENTRYPOINT ["/sbin/my_init"]

