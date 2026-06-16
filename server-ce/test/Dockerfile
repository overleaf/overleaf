FROM node:24.14.1

# Corepack setup, shared between all the images.
ENV PATH="/overleaf/node_modules/.bin:$PATH"
ENV COREPACK_HOME=/opt/corepack
RUN corepack enable && corepack install -g yarn@4.14.1
ENV COREPACK_ENABLE_NETWORK=0

RUN curl -fsSL https://download.docker.com/linux/debian/gpg | apt-key add - \
&&  echo \
      "deb [arch=$(dpkg --print-architecture)] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list \
&&  apt-get update \
&&  apt-get install -y docker-ce-cli docker-compose-plugin  \
&&  rm -rf /var/lib/apt/lists/*
