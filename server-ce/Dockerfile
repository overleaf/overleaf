# ---------------------------------------------
# Overleaf Community Edition (overleaf/overleaf)
# ---------------------------------------------

ARG SHARELATEX_BASE_TAG=sharelatex/sharelatex-base:latest
FROM $SHARELATEX_BASE_TAG

ENV SHARELATEX_CONFIG /etc/sharelatex/settings.coffee


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


# Copy build dependencies
# -----------------------
ADD ${baseDir}/git-revision.sh /var/www/git-revision.sh
ADD ${baseDir}/services.js /var/www/sharelatex/config/services.js


# Checkout services
# -----------------
RUN cd /var/www/sharelatex \
&&    npm install \
&&    grunt install \
  \
# Cleanup not needed artifacts
# ----------------------------
&&  rm -rf /root/.cache /root/.npm $(find /tmp/ -mindepth 1 -maxdepth 1) \
# Stores the version installed for each service
# ---------------------------------------------
&&  cd /var/www \
&&    ./git-revision.sh > revisions.txt \
  \
# Cleanup the git history
# -------------------
&&  rm -rf $(find /var/www/sharelatex -name .git)

# Install npm dependencies
# ------------------------
RUN cd /var/www/sharelatex \
&&    bash ./bin/install-services \
  \
# Cleanup not needed artifacts
# ----------------------------
&&  rm -rf /root/.cache /root/.npm $(find /tmp/ -mindepth 1 -maxdepth 1)

# Compile CoffeeScript
# --------------------
RUN cd /var/www/sharelatex \
&&    bash ./bin/compile-services

# Links CLSI sycntex to its default location
# ------------------------------------------
RUN ln -s /var/www/sharelatex/clsi/bin/synctex /opt/synctex


# Copy runit service startup scripts to its location
# --------------------------------------------------
ADD ${baseDir}/runit /etc/service


# Configure nginx
# ---------------
ADD ${baseDir}/nginx/nginx.conf /etc/nginx/nginx.conf
ADD ${baseDir}/nginx/sharelatex.conf /etc/nginx/sites-enabled/sharelatex.conf


# Configure log rotation
# ----------------------
ADD ${baseDir}/logrotate/sharelatex /etc/logrotate.d/sharelatex


# Copy Phusion Image startup scripts to its location
# --------------------------------------------------
COPY ${baseDir}/init_scripts/ /etc/my_init.d/

# Copy app settings files
# -----------------------
COPY ${baseDir}/settings.coffee /etc/sharelatex/settings.coffee

# Set Environment Variables
# --------------------------------
ENV WEB_API_USER "sharelatex"

ENV SHARELATEX_APP_NAME "Overleaf Community Edition"

ENV OPTIMISE_PDF "true"


EXPOSE 80

WORKDIR /

ENTRYPOINT ["/sbin/my_init"]

