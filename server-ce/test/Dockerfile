FROM node:20.18.2
RUN curl -fsSL https://download.docker.com/linux/debian/gpg | apt-key add - \
&&  echo \
      "deb [arch=$(dpkg --print-architecture)] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list \
&&  apt-get update \
&&  apt-get install -y docker-ce-cli docker-compose-plugin  \
&&  rm -rf /var/lib/apt/lists/*
