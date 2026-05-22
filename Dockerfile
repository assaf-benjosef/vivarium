FROM node:22-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# ---

FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    chromium fonts-liberation \
    sqlite3 \
    python3 python3-pip python3-venv \
    curl wget jq vim-tiny lsof procps \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Install ngrok
RUN curl -sSL https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz | tar xz -C /usr/local/bin

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist/ ./dist/
COPY skills/ ./skills/
COPY workspace-template/ ./workspace-template/

# Create non-root user — Claude Agent SDK refuses bypassPermissions as root
RUN useradd -m -s /bin/bash terry \
    && echo "terry ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

RUN mkdir -p /workspace && chown terry:terry /workspace
VOLUME /workspace
EXPOSE 3000

USER terry
CMD ["node", "/app/dist/index.js"]
