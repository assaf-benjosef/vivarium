#!/bin/bash
set -e

NAME="${1:?Usage: rollback.sh <name>}"
cd /workspace

# Verify the snapshot exists
if ! git tag -l "$NAME" | grep -q .; then
    echo "Error: Snapshot '$NAME' not found."
    echo "Available snapshots:"
    git tag -l --sort=-creatordate | head -20
    exit 1
fi

# Save current state before rollback
git add -A
git diff-index --quiet HEAD 2>/dev/null || git commit -m "auto: before rollback to '$NAME'"

# Restore files to snapshot state
git checkout "$NAME" -- .
git add -A
git commit -m "Rolled back to snapshot '$NAME'" --allow-empty

echo "✅ Rolled back to snapshot '$NAME'"
