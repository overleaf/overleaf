FROM ubuntu:20.04

# Makes sure LuaTex cache is writable
# -----------------------------------
ENV TEXMFVAR=/var/lib/sharelatex/tmp/texmf-var


# Install dependencies
# --------------------
RUN apt-get update \
&&  DEBIAN_FRONTEND="noninteractive" apt-get install -y \
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
# CTAN mirrors occasionally fail, in that case install TexLive against an
# specific server, for example http://ctan.crest.fr
#
# # docker build \
#     --build-arg TEXLIVE_MIRROR=http://ctan.crest.fr/tex-archive/systems/texlive/tlnet \
#     -f Dockerfile-base -t sharelatex/sharelatex-base .
ARG TEXLIVE_MIRROR=http://mirror.ctan.org/systems/texlive/tlnet

ENV PATH "${PATH}:/usr/local/texlive/2021/bin/x86_64-linux"

RUN mkdir /install-tl-unx \
&&  curl -sSL \
      ${TEXLIVE_MIRROR}/install-tl-unx.tar.gz \
    | tar -xzC /install-tl-unx --strip-components=1 \
    \
&&  echo "tlpdbopt_autobackup 0" >> /install-tl-unx/texlive.profile \
&&  echo "tlpdbopt_install_docfiles 0" >> /install-tl-unx/texlive.profile \
&&  echo "tlpdbopt_install_srcfiles 0" >> /install-tl-unx/texlive.profile \
&&  echo "selected_scheme scheme-basic" >> /install-tl-unx/texlive.profile \
    \
&&  /install-tl-unx/install-tl \
      -profile /install-tl-unx/texlive.profile \
      -repository ${TEXLIVE_MIRROR} \
    \
&&  tlmgr install --repository ${TEXLIVE_MIRROR} \
      latexmk \
      texcount \
      synctex \
    \
&&  rm -rf /install-tl-unx


# Set up sharelatex user and home directory
# -----------------------------------------
RUN mkdir -p /var/lib/sharelatex && \
	mkdir -p /var/log/sharelatex && \
	mkdir -p /var/lib/sharelatex/data/template_files