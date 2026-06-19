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

# Install cloudflared for public URL tunnels
RUN ARCH=$(dpkg --print-architecture) && \
    curl -sSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}.deb" -o /tmp/cloudflared.deb && \
    dpkg -i /tmp/cloudflared.deb && rm /tmp/cloudflared.deb

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist/ ./dist/
COPY skills/ ./skills/
COPY workspace-template/ ./workspace-template/

# Create non-root user — Claude Agent SDK refuses bypassPermissions as root
RUN useradd -m -s /bin/bash viv \
    && echo "viv ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

RUN mkdir -p /workspace && chown viv:viv /workspace
VOLUME /workspace
EXPOSE 3000

COPY scripts/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

USER viv
CMD ["/app/entrypoint.sh"]
