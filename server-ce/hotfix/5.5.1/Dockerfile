FROM sharelatex/sharelatex:5.5.0


# fix tls configuration in redis for history-v1
COPY pr_25168.patch .
RUN patch -p1 < pr_25168.patch && rm pr_25168.patch

# improve logging in history system
COPY pr_26086.patch .
RUN patch -p1 < pr_26086.patch && rm pr_26086.patch

# fix create-user.mjs script
COPY pr_26152.patch .
RUN patch -p1 < pr_26152.patch && rm pr_26152.patch

# check mongo featureCompatibilityVersion
COPY pr_26091.patch .
RUN patch -p1 < pr_26091.patch && rm pr_26091.patch

# update multer and tar-fs
RUN sed -i 's/"multer": "2.0.0"/"multer": "2.0.1"/g' package.json
RUN sed -i 's/"dockerode": "^4.0.5"/"dockerode": "^4.0.7"/g' services/clsi/package.json
RUN sed -i 's/"tar-fs": "^3.0.4"/"tar-fs": "^3.0.9"/g' services/clsi/package.json
RUN sed -i 's/199c5ff05bd375c508f4074498237baead7f5148/4dbceda355efc3fc8ac3cf5c66c3778c8a6fdb23/g' services/web/package.json
COPY package-lock.json.diff .
RUN patch package-lock.json < package-lock.json.diff
RUN npm install --omit=dev
RUN npm install  @paralleldrive/cuid2@2.2.2 -w services/history-v1
