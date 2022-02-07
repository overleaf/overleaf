# ---------------------------------------------
# Overleaf Community Edition (overleaf/overleaf)
# ---------------------------------------------

ARG SHARELATEX_BASE_TAG=sharelatex/sharelatex-base:latest
FROM $SHARELATEX_BASE_TAG

WORKDIR /overleaf

# Add required source files
# -------------------------
ADD server-ce/genScript.js /overleaf/genScript.js
ADD server-ce/services.js /overleaf/services.js
ADD package.json package-lock.json /overleaf/
ADD libraries/ /overleaf/libraries/
ADD services/ /overleaf/services/

# Store the revision
# ------------------
ARG MONOREPO_REVISION
RUN echo "monorepo-server-ce,$MONOREPO_REVISION" > /var/www/revisions.txt

# Upgrade npm for workspaces support
# ----------------------------------
RUN npm install -g npm@7.24.2

# Install npm dependencies
# ------------------------
RUN node genScript install | bash

# Compile
# --------------------
RUN node genScript compile | bash

# Copy runit service startup scripts to its location
# --------------------------------------------------
ADD server-ce/runit /etc/service


# Configure nginx
# ---------------
ADD server-ce/nginx/nginx.conf.template /etc/nginx/templates/nginx.conf.template
ADD server-ce/nginx/sharelatex.conf /etc/nginx/sites-enabled/sharelatex.conf


# Configure log rotation
# ----------------------
ADD server-ce/logrotate/sharelatex /etc/logrotate.d/sharelatex
RUN chmod 644 /etc/logrotate.d/sharelatex


# Copy Phusion Image startup scripts to its location
# --------------------------------------------------
COPY server-ce/init_scripts/ /etc/my_init.d/

# Copy app settings files
# -----------------------
COPY server-ce/settings.js /etc/sharelatex/settings.js

# Copy grunt thin wrapper
# -----------------------
ADD server-ce/bin/grunt /usr/local/bin/grunt
RUN chmod +x /usr/local/bin/grunt

# Set Environment Variables
# --------------------------------
ENV SHARELATEX_CONFIG /etc/sharelatex/settings.js

ENV WEB_API_USER "sharelatex"

ENV SHARELATEX_APP_NAME "Overleaf Community Edition"

ENV OPTIMISE_PDF "true"

ENV NODE_ENV "production"
ENV LOG_LEVEL "info"


EXPOSE 80

WORKDIR /

ENTRYPOINT ["/sbin/my_init"]

