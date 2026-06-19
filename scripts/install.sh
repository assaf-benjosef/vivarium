#!/usr/bin/env bash
set -euo pipefail

# Vivarium bootstrap — installs the CLI and starts a vivarium.
# Usage: curl -fsSL https://vivarium.run/install | bash -s -- --token <TOKEN>

MIN_NODE=22

command_exists() { command -v "$1" &>/dev/null; }

ensure_node() {
  if command_exists node; then
    local ver
    ver=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$ver" -ge "$MIN_NODE" ]; then
      return
    fi
    echo "Node.js $ver found but $MIN_NODE+ required."
  fi

  echo "Installing Node.js via fnm..."
  if ! command_exists fnm; then
    curl -fsSL https://fnm.vercel.app/install | bash -s -- --skip-shell
    export PATH="$HOME/.local/share/fnm:$PATH"
    eval "$(fnm env)"
  fi
  fnm install "$MIN_NODE" && fnm use "$MIN_NODE"
}

ensure_node
echo "Node.js $(node -v) ✓"

echo "Installing @vivarium/cli..."
npm install -g @vivarium/cli

echo ""
exec viv start "$@"
