#!/bin/bash
cd /workspace

TAGS=$(git tag -l --sort=-creatordate)

if [ -z "$TAGS" ]; then
    echo "No snapshots found."
    echo ""
    echo "Recent commits:"
    git log --oneline -10
    exit 0
fi

echo "📸 Snapshots (newest first):"
echo ""
for tag in $TAGS; do
    DATE=$(git log -1 --format="%ci" "$tag" 2>/dev/null | cut -d' ' -f1,2)
    MSG=$(git tag -l -n1 "$tag" | sed "s/^$tag\s*//")
    echo "  $tag  ($DATE)  $MSG"
done
