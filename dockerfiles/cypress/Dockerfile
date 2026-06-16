FROM cypress/included:15.12.0
ARG USER_UID=1000
ARG USER_GID=1000

# Corepack setup, shared between all the images.
ENV PATH="/overleaf/node_modules/.bin:$PATH"
ENV COREPACK_HOME=/opt/corepack
RUN corepack enable && corepack install -g yarn@4.14.1
ENV COREPACK_ENABLE_NETWORK=0

WORKDIR /overleaf

RUN sed -i s/node:x:1000:/node:x:${USER_GID}:/ /etc/group \
&&  sed -i s_node:x:1000:1000::/home/node:/bin/bash_node:x:${USER_UID}:${USER_GID}::/home/node:/bin/bash_ /etc/passwd \
&&  chown -R node:node /home/node \
&&  chown node:node /overleaf

USER node
