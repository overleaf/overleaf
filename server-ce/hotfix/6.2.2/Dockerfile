FROM sharelatex/sharelatex:6.2.1

# Apply security updates to base image
RUN apt update && apt install -y linux-libc-dev \
  && unattended-upgrade --verbose --no-minimal-upgrade-steps \
  && rm -rf /var/lib/apt/lists/*

# bump protobufjs to 7.6.3 and @protobufjs/* packages
COPY pr_33656.patch .
RUN patch -p1 < pr_33656.patch && rm pr_33656.patch

# bump form-data to 2.5.6
COPY pr_34920.patch .
RUN patch -p1 < pr_34920.patch && rm pr_34920.patch

# bump @grpc/grpc-js to 1.14.4
COPY pr_34580.patch .
RUN patch -p1 < pr_34580.patch && rm pr_34580.patch

# bump multer to 2.2.0
COPY pr_34916.patch .
RUN patch -p1 < pr_34916.patch && rm pr_34916.patch

# fix projectInviteEncryptorOptions assignment in settings.js
COPY fix_invite_token_secret.patch .
RUN patch -p1 < fix_invite_token_secret.patch && rm fix_invite_token_secret.patch

# gate group link sharing behind feature flag, remove debug logging
COPY pr_34394.patch .
RUN patch -p1 < pr_34394.patch && rm pr_34394.patch

# migrate email sender from @aws-sdk/client-ses to @aws-sdk/client-sesv2
COPY pr_35531.patch .
RUN patch -p1 < pr_35531.patch && rm pr_35531.patch

# add script for flushing/discarding stuck docs
COPY pr_35603.patch .
RUN patch -p1 < pr_35603.patch && rm pr_35603.patch

RUN yarn workspace @overleaf/web remove @aws-sdk/client-ses \
  && yarn workspace @overleaf/web add @aws-sdk/client-sesv2@3.994.0  \
  && yarn install --no-immutable  \
  && node genScript compile | bash \
  && yarn workspaces focus --all --production
