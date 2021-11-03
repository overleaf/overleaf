FROM ubuntu:20.04

# Makes sure LuaTex cache is writable
# -----------------------------------
ENV TEXMFVAR=/var/lib/sharelatex/tmp/texmf-var


# Install dependencies
# --------------------
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
&&  apt-get install -y \
      build-essential wget net-tools unzip time imagemagick optipng strace nginx git python zlib1g-dev libpcre3-dev \
      qpdf \
      aspell aspell-en aspell-af aspell-am aspell-ar aspell-ar-large aspell-bg aspell-bn aspell-br aspell-ca aspell-cs aspell-cy aspell-da aspell-de aspell-el aspell-eo aspell-es aspell-et aspell-eu-es aspell-fa aspell-fo aspell-fr aspell-ga aspell-gl-minimos aspell-gu aspell-he aspell-hi aspell-hr aspell-hsb aspell-hu aspell-hy aspell-id aspell-is aspell-it aspell-kk aspell-kn aspell-ku aspell-lt aspell-lv aspell-ml aspell-mr aspell-nl aspell-nr aspell-ns  aspell-pa aspell-pl aspell-pt aspell-pt-br aspell-ro aspell-ru aspell-sk aspell-sl aspell-ss aspell-st aspell-sv aspell-tl aspell-tn aspell-ts aspell-uk aspell-uz aspell-xh aspell-zu \
    \
# install Node.JS 12
&&  curl -sSL https://deb.nodesource.com/setup_12.x | bash - \
&&  apt-get install -y nodejs \
    \
&&  rm -rf \
# We are adding a custom nginx config in the main Dockerfile.
      /etc/nginx/nginx.conf \
      /etc/nginx/sites-enabled/default \
      /var/lib/apt/lists/*

# Add envsubst
# ------------
ADD server-ce/vendor/envsubst /usr/bin/envsubst
RUN chmod +x /usr/bin/envsubst

# Install TexLive
# ---------------
# Skipped!


# Set up sharelatex user and home directory
# -----------------------------------------
RUN mkdir -p /var/lib/sharelatex && \
	mkdir -p /var/log/sharelatex && \
	mkdir -p /var/lib/sharelatex/data/template_files
