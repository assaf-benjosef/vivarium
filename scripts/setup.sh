#!/usr/bin/env bash
set -euo pipefail

# Vivarium Setup Script
# Installs and runs a vivarium using Docker (default) or SmolVM.

DEFAULT_HUB_URL="wss://hub.vivarium.run/ws"
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
    docker pull "ghcr.io/vivarium/vivarium:latest" || die "Docker pull failed."
    DOCKER_IMAGE="ghcr.io/vivarium/vivarium:latest"
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
    --restart unless-stopped \
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

# --- SmolVM setup ---
smolvm_setup() {
  # Install smolvm if needed
  if ! command -v smolvm >/dev/null 2>&1; then
    log "Installing SmolVM..."
    curl -sSL https://smolmachines.com/install.sh | bash || die "SmolVM installation failed."
  fi

  local smolfile="$REPO_DIR/vivarium.smolfile"
  [[ -f "$smolfile" ]] || die "Smolfile not found at $smolfile"

  # Generate per-vivarium Smolfile with correct port
  local tmp_smolfile="/tmp/${CONTAINER_NAME}.smolfile"
  sed "s|\"3000:3000\"|\"${PORT}:3000\"|" "$smolfile" > "$tmp_smolfile"

  # Check for existing machine with same name
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

  log "Creating SmolVM machine '$CONTAINER_NAME'..."
  smolvm machine create "$CONTAINER_NAME" -s "$tmp_smolfile" || die "SmolVM machine creation failed."

  log "Starting SmolVM machine..."
  smolvm machine start --name "$CONTAINER_NAME" || die "SmolVM machine start failed."

  # Wait for machine to be ready for exec (init commands install system deps — can take a few minutes)
  log "Waiting for init commands to finish (installing system deps)..."
  local retries=0
  until smolvm machine exec --name "$CONTAINER_NAME" -- true 2>/dev/null; do
    retries=$((retries + 1))
    [[ $retries -ge 120 ]] && die "Machine started but not accepting commands after 2 minutes."
    sleep 2
  done

  # Build TypeScript if dist/ doesn't exist
  if [[ ! -d "$REPO_DIR/dist" ]]; then
    log "Building TypeScript..."
    (cd "$REPO_DIR" && npm run build) || die "TypeScript build failed."
  fi

  # Copy app files into VM
  log "Deploying app into VM..."
  local tar_file="/tmp/${CONTAINER_NAME}-app.tar"
  # Use GNU tar if available (avoids macOS LIBARCHIVE.xattr headers that GNU tar on Linux complains about)
  local tar_cmd="tar"
  command -v gtar >/dev/null 2>&1 && tar_cmd="gtar"
  (cd "$REPO_DIR" && COPYFILE_DISABLE=1 $tar_cmd cf "$tar_file" --no-mac-metadata package.json package-lock.json dist/ skills/ workspace-template/ 2>/dev/null)
  smolvm machine exec --name "$CONTAINER_NAME" -- mkdir -p /app
  smolvm machine cp "$tar_file" "$CONTAINER_NAME:/tmp/app.tar"
  smolvm machine exec --name "$CONTAINER_NAME" -- tar xf /tmp/app.tar -C /app
  smolvm machine exec --name "$CONTAINER_NAME" -- rm /tmp/app.tar
  rm -f "$tar_file"

  # Install production dependencies
  log "Installing dependencies inside VM..."
  smolvm machine exec --name "$CONTAINER_NAME" -- sh -c "cd /app && npm ci --omit=dev"

  # Write env and start files locally, then copy into VM
  local smolvm_hub_url
  smolvm_hub_url=$(resolve_hub_url "$HUB_URL" "smolvm")

  local tmp_env="/tmp/${CONTAINER_NAME}-env.sh"
  cat > "$tmp_env" << EOF
export ANTHROPIC_API_KEY="$API_KEY"
export HUB_URL="$smolvm_hub_url"
export HUB_TOKEN="$TOKEN"
export VIVARIUM_NAME="$NAME"
export PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium"
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD="true"
EOF
  smolvm machine cp "$tmp_env" "$CONTAINER_NAME:/app/env.sh"
  rm -f "$tmp_env"

  local tmp_start="/tmp/${CONTAINER_NAME}-start.sh"
  cat > "$tmp_start" << 'EOF'
#!/bin/bash
source /app/env.sh
exec sudo -u viv -E node /app/dist/index.js
EOF
  smolvm machine cp "$tmp_start" "$CONTAINER_NAME:/app/start.sh"
  smolvm machine exec --name "$CONTAINER_NAME" -- chmod +x /app/start.sh
  rm -f "$tmp_start"

  # Run the app via start.sh (detached, suppress output leaking to host terminal)
  log "Launching vivarium..."
  smolvm machine exec --name "$CONTAINER_NAME" -- bash /app/start.sh >/dev/null 2>&1 &

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
    exec_args="machine start --name ${CONTAINER_NAME}"
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
  <true/>
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
    exec_start="$(command -v smolvm) machine start --name ${CONTAINER_NAME}"
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
Restart=always
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
  printf "   Stop:      smolvm machine stop --name %s\n" "$CONTAINER_NAME"
  printf "   Restart:   smolvm machine start --name %s\n" "$CONTAINER_NAME"
fi
printf "\n"
