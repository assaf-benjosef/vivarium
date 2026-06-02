#!/usr/bin/env bash
set -euo pipefail

# Vivarium Setup Script
# Installs and runs a vivarium using Docker (default) or SmolVM.

DEFAULT_HUB_URL="wss://app.vivarium.run/ws"
GHCR_IMAGE="ghcr.io/assaf-benjosef/vivarium"
PACK_URL_BASE="https://github.com/assaf-benjosef/vivarium/releases"
PACK_CACHE_DIR="${HOME}/.cache/vivarium/packs"
DOCKER_IMAGE="vivarium"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

# --- Argument defaults ---
TOKEN=""
USE_DOCKER=true
HUB_URL="$DEFAULT_HUB_URL"
NAME=""
PORT=""
API_KEY="${ANTHROPIC_API_KEY:-}"
VIVARIUM_VERSION="latest"

log()  { printf "\033[1;32m%s\033[0m %s\n" ">" "$*"; }
warn() { printf "\033[1;33m%s\033[0m %s\n" "!" "$*"; }
die()  { printf "\033[1;31m%s\033[0m %s\n" "x" "$*" >&2; exit 1; }

# --- Parse arguments ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --token)    TOKEN="$2"; shift 2 ;;
    --docker)   USE_DOCKER=true; shift ;;
    --smolvm)   USE_DOCKER=false; shift ;;
    --hub-url)  HUB_URL="$2"; shift 2 ;;
    --name)     NAME="$2"; shift 2 ;;
    --port)     PORT="$2"; shift 2 ;;
    --api-key)  API_KEY="$2"; __API_KEY_FROM_FLAG=1; shift 2 ;;
    --version)  VIVARIUM_VERSION="$2"; shift 2 ;;
    -h|--help)
      cat <<EOF
Usage: $0 --token TOKEN [options]

Options:
  --token TOKEN     JWT token from /setup command (required)
  --docker          Use Docker runtime (default)
  --smolvm          Use SmolVM runtime
  --hub-url URL     Hub WebSocket URL (default: $DEFAULT_HUB_URL)
  --name NAME       Vivarium name (prompted if not set)
  --port PORT       Host port for app (auto-detected if not set)
  --api-key KEY     Anthropic API key (prompted if not set)
  --version TAG     Release version for SmolVM pack / Docker image (default: latest)
  -h, --help        Show this help
EOF
      exit 0
      ;;
    *) die "Unknown option: $1" ;;
  esac
done

[[ -z "$TOKEN" ]] && die "Missing required --token argument. Run /setup in Telegram to get one."

# --- Prompt for missing values ---

if [[ -z "$API_KEY" ]]; then
  printf "\n"
  read -sp "Enter your Anthropic API key: " API_KEY
  printf "\n"
  [[ -z "$API_KEY" ]] && die "API key is required."
elif [[ -z "${__API_KEY_FROM_FLAG:-}" ]]; then
  # API_KEY came from env var, not --api-key flag — confirm with user
  masked="${API_KEY:0:12}...${API_KEY: -4}"
  printf "\n"
  read -p "Found ANTHROPIC_API_KEY in environment ($masked). Use it? [Y/n] " use_env
  if [[ "$use_env" =~ ^[Nn]$ ]]; then
    read -sp "Enter your Anthropic API key: " API_KEY
    printf "\n"
    [[ -z "$API_KEY" ]] && die "API key is required."
  fi
fi

if [[ -z "$NAME" ]]; then
  read -p "Enter a name for this vivarium [my-vivarium]: " NAME
  NAME="${NAME:-my-vivarium}"
fi

# Sanitize name for use as container/machine name
SAFE_NAME="$(echo "$NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')"
CONTAINER_NAME="vivarium-${SAFE_NAME}"

# --- Find available port ---
find_available_port() {
  local port="${1:-3000}"
  local max=$((port + 100))
  while [[ $port -lt $max ]]; do
    if ! lsof -i :"$port" >/dev/null 2>&1; then
      echo "$port"
      return
    fi
    port=$((port + 1))
  done
  die "No available port found in range 3000-3099"
}

if [[ -z "$PORT" ]]; then
  PORT=$(find_available_port 3000)
fi

# --- Resolve HUB_URL for container/VM networking ---
get_host_ip() {
  if [[ "$(uname)" == "Darwin" ]]; then
    ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null
  else
    hostname -I 2>/dev/null | awk '{print $1}'
  fi
}

resolve_hub_url() {
  local url="$1"
  local runtime="$2"
  if [[ "$url" == *"localhost"* ]] || [[ "$url" == *"127.0.0.1"* ]]; then
    if [[ "$runtime" == "docker" ]] && [[ "$(uname)" == "Darwin" ]]; then
      url="${url//localhost/host.docker.internal}"
      url="${url//127.0.0.1/host.docker.internal}"
    elif [[ "$runtime" == "smolvm" ]]; then
      local host_ip
      host_ip=$(get_host_ip)
      [[ -z "$host_ip" ]] && die "Cannot detect host IP for SmolVM networking."
      url="${url//localhost/$host_ip}"
      url="${url//127.0.0.1/$host_ip}"
    fi
  fi
  echo "$url"
}

# --- Docker setup ---
docker_setup() {
  command -v docker >/dev/null 2>&1 || die "Docker is not installed. Install Docker Desktop or use --smolvm."
  docker info >/dev/null 2>&1 || die "Docker daemon is not running. Start Docker Desktop and try again."

  # Build from local repo if Dockerfile exists, otherwise pull
  if [[ -f "$REPO_DIR/Dockerfile" ]]; then
    log "Building vivarium Docker image..."
    docker build -t "$DOCKER_IMAGE" "$REPO_DIR" || die "Docker build failed."
  else
    log "Pulling vivarium Docker image..."
    local pull_tag="latest"
    [[ "$VIVARIUM_VERSION" != "latest" ]] && pull_tag="${VIVARIUM_VERSION#v}"
    docker pull "${GHCR_IMAGE}:${pull_tag}" || die "Docker pull failed."
    DOCKER_IMAGE="${GHCR_IMAGE}:${pull_tag}"
  fi

  local docker_hub_url
  docker_hub_url=$(resolve_hub_url "$HUB_URL" "docker")

  # Check for existing container with same name
  if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    warn "Container '$CONTAINER_NAME' already exists."
    read -p "Remove it and start fresh? [y/N] " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
      docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1
    else
      die "Aborted. Remove it manually with: docker rm -f $CONTAINER_NAME"
    fi
  fi

  log "Starting vivarium container..."

  local network_args=()
  # On Linux with localhost URL, use host networking
  if [[ "$(uname)" == "Linux" ]] && { [[ "$HUB_URL" == *"localhost"* ]] || [[ "$HUB_URL" == *"127.0.0.1"* ]]; }; then
    network_args=(--network host)
  else
    network_args=(-p "${PORT}:3000")
  fi

  docker run -d \
    --name "$CONTAINER_NAME" \
    --restart on-failure \
    -e ANTHROPIC_API_KEY="$API_KEY" \
    -e HUB_URL="$docker_hub_url" \
    -e HUB_TOKEN="$TOKEN" \
    -e VIVARIUM_NAME="$NAME" \
    -v "${CONTAINER_NAME}-data:/workspace" \
    "${network_args[@]}" \
    "$DOCKER_IMAGE" >/dev/null

  # Wait a moment and check it's running
  sleep 2
  if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    warn "Container may have crashed. Logs:"
    docker logs "$CONTAINER_NAME" 2>&1 | tail -20
    die "Vivarium failed to start."
  fi

  log "Vivarium container is running."
}

# --- Download pre-built SmolVM pack ---
download_pack() {
  local version="$1"
  local pack_file="vivarium.smolmachine"
  local version_dir="${PACK_CACHE_DIR}/${version}"
  local dest="${version_dir}/${pack_file}"

  mkdir -p "$version_dir"

  if [[ -f "$dest" ]] && [[ "$version" != "latest" ]]; then
    log "Using cached pack: $dest" >&2
    echo "$dest"
    return
  fi

  local download_url
  if [[ "$version" == "latest" ]]; then
    download_url="${PACK_URL_BASE}/latest/download/${pack_file}"
  else
    download_url="${PACK_URL_BASE}/download/${version}/${pack_file}"
  fi

  log "Downloading SmolVM pack ($version)..." >&2
  curl -fSL --progress-bar -o "$dest" "$download_url" \
    || die "Failed to download pack from $download_url. Use --docker instead."

  echo "$dest"
}

# --- SmolVM setup ---
smolvm_setup() {
  if ! command -v smolvm >/dev/null 2>&1; then
    log "Installing SmolVM..."
    curl -sSL https://smolmachines.com/install.sh | bash || die "SmolVM installation failed."
  fi

  local pack_path
  pack_path=$(download_pack "$VIVARIUM_VERSION")

  if smolvm machine status --name "$CONTAINER_NAME" >/dev/null 2>&1; then
    warn "Machine '$CONTAINER_NAME' already exists."
    read -p "Remove it and start fresh? [y/N] " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
      smolvm machine stop --name "$CONTAINER_NAME" 2>/dev/null || true
      smolvm machine delete "$CONTAINER_NAME" -f 2>/dev/null || true
    else
      die "Aborted. Remove it manually with: smolvm machine delete $CONTAINER_NAME -f"
    fi
  fi

  local smolvm_hub_url
  smolvm_hub_url=$(resolve_hub_url "$HUB_URL" "smolvm")

  log "Creating SmolVM machine '$CONTAINER_NAME' from pack..."
  smolvm machine create "$CONTAINER_NAME" \
    --from "$pack_path" \
    --port "${PORT}:3000" \
    --net \
    -e "ANTHROPIC_API_KEY=${API_KEY}" \
    -e "HUB_URL=${smolvm_hub_url}" \
    -e "HUB_TOKEN=${TOKEN}" \
    -e "VIVARIUM_NAME=${NAME}" \
    -e "PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium" \
    -e "PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true" \
    --init "env > /tmp/vivarium.env" \
    --init "sh -c 'set -a && . /tmp/vivarium.env && set +a && /app/entrypoint.sh &'" \
    || die "SmolVM machine creation failed."

  log "Starting SmolVM machine..."
  smolvm machine start --name "$CONTAINER_NAME" || die "SmolVM machine start failed."

  log "Waiting for vivarium to start..."
  local retries=0
  until smolvm machine exec --name "$CONTAINER_NAME" -- pgrep -x node >/dev/null 2>&1; do
    retries=$((retries + 1))
    if [[ $retries -ge 15 ]]; then
      warn "Vivarium process did not start. Check logs with:"
      warn "  smolvm machine exec --name $CONTAINER_NAME -- cat /tmp/vivarium.log"
      die "Startup failed."
    fi
    sleep 2
  done

  log "SmolVM machine is running."
}

# --- Auto-restart service ---
install_service() {
  local runtime="$1"

  if [[ "$(uname)" == "Darwin" ]]; then
    install_launchd_service "$runtime"
  elif command -v systemctl >/dev/null 2>&1; then
    install_systemd_service "$runtime"
  else
    warn "Auto-restart not configured (no systemd or launchd found)."
    warn "You'll need to restart the vivarium manually after reboots."
  fi
}

install_launchd_service() {
  local runtime="$1"
  local plist_dir="$HOME/Library/LaunchAgents"
  local plist_file="${plist_dir}/com.vivarium.${SAFE_NAME}.plist"

  mkdir -p "$plist_dir"

  local exec_path exec_args
  if [[ "$runtime" == "docker" ]]; then
    exec_path="$(command -v docker)"
    exec_args="start -a ${CONTAINER_NAME}"
  else
    exec_path="$(command -v smolvm)"
    exec_args="machine monitor --name ${CONTAINER_NAME}"
  fi

  cat > "$plist_file" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.vivarium.${SAFE_NAME}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${exec_path}</string>
$(for arg in $exec_args; do echo "    <string>${arg}</string>"; done)
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>StandardOutPath</key>
  <string>/tmp/vivarium-${SAFE_NAME}.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/vivarium-${SAFE_NAME}.err</string>
</dict>
</plist>
EOF

  launchctl unload "$plist_file" 2>/dev/null || true
  launchctl load "$plist_file"
  log "LaunchAgent installed at $plist_file"
}

install_systemd_service() {
  local runtime="$1"
  local service_dir="$HOME/.config/systemd/user"
  local service_file="${service_dir}/vivarium-${SAFE_NAME}.service"

  mkdir -p "$service_dir"

  local exec_start
  if [[ "$runtime" == "docker" ]]; then
    exec_start="$(command -v docker) start -a ${CONTAINER_NAME}"
  else
    exec_start="$(command -v smolvm) machine monitor --name ${CONTAINER_NAME}"
  fi

  local exec_stop
  if [[ "$runtime" == "docker" ]]; then
    exec_stop="$(command -v docker) stop ${CONTAINER_NAME}"
  else
    exec_stop="$(command -v smolvm) machine stop --name ${CONTAINER_NAME}"
  fi

  cat > "$service_file" << EOF
[Unit]
Description=Vivarium - ${NAME}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${exec_start}
ExecStop=${exec_stop}
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
EOF

  systemctl --user daemon-reload
  systemctl --user enable --now "vivarium-${SAFE_NAME}.service"
  log "Systemd user service installed at $service_file"
}

# --- Main ---
printf "\n\033[1;32m🌱 Vivarium Setup\033[0m\n"
printf "──────────────────\n\n"

if [[ "$USE_DOCKER" == true ]]; then
  docker_setup
  install_service "docker"
else
  smolvm_setup
  install_service "smolvm"
fi

printf "\n\033[1;32m🌱 \"%s\" is online!\033[0m\n\n" "$NAME"
printf "   Your app:  http://localhost:%s  (on this machine)\n" "$PORT"
printf "   Chat:      Go back to Telegram and start talking!\n\n"

if [[ "$USE_DOCKER" == true ]]; then
  printf "   Logs:      docker logs -f %s\n" "$CONTAINER_NAME"
  printf "   Shell:     docker exec -it %s bash\n" "$CONTAINER_NAME"
  printf "   Stop:      docker stop %s\n" "$CONTAINER_NAME"
  printf "   Restart:   docker start %s\n" "$CONTAINER_NAME"
else
  printf "   Shell:     smolvm machine exec -it --name %s -- bash\n" "$CONTAINER_NAME"
  printf "   Logs:      smolvm machine exec --name %s -- cat /tmp/vivarium.log\n" "$CONTAINER_NAME"
  printf "   Stop:      smolvm machine stop --name %s\n" "$CONTAINER_NAME"
  printf "   Restart:   smolvm machine start --name %s\n" "$CONTAINER_NAME"
fi
printf "\n"
