FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY app.js ./
COPY lib ./lib

ENV WORKSPACE_DIR=/workspace
VOLUME ["/workspace"]

CMD ["node", "app.js"]
