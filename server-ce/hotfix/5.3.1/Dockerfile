FROM sharelatex/sharelatex:5.3.0

# Update copyright year
COPY pr_22950.patch .
RUN patch -p0 < pr_22950.patch && rm pr_22950.patch


# Update Mongoose
RUN npm install mongoose@^8.9.5 --save -w services/web \
  && npm install mongodb@6.12.0 --save \
    -w services/chat -w services/contacts -w services/docstore \
    -w services/history-v1 -w libraries/mongo-utils \
  && npm install mongodb@6.12.0 --save \
  && rm -rf /root/.cache /root/.npm $(find /tmp/ -mindepth 1 -maxdepth 1)
