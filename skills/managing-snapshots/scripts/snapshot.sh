#!/bin/bash
set -e

NAME="${1:?Usage: snapshot.sh <name>}"
cd /workspace

# Stage and commit any uncommitted changes first
git add -A
git diff-index --quiet HEAD 2>/dev/null || git commit -m "auto: before snapshot '$NAME'"

# Create the tag
if git tag -l "$NAME" | grep -q .; then
    echo "Error: Snapshot '$NAME' already exists. Use a different name."
    exit 1
fi

git tag -a "$NAME" -m "Snapshot: $NAME ($(date '+%Y-%m-%d %H:%M:%S'))"
echo "✅ Snapshot '$NAME' created successfully"
