FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    chromium fonts-liberation \
    sqlite3 \
    python3 python3-pip python3-venv \
    curl wget jq vim-tiny lsof procps \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
COPY skills/ ./skills/
COPY workspace-template/ ./workspace-template/

VOLUME /workspace
EXPOSE 3000

CMD ["node", "/app/dist/index.js"]
