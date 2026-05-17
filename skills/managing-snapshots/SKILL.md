---
name: managing-snapshots
description: >-
  Manages workspace snapshots using git for version control and rollback.
  Handles creating named snapshots, listing history, rolling back to
  previous versions, and showing diffs. Use when the user asks to save,
  undo, rollback, restore, bookmark, or view history of their app.
---

# Managing Snapshots

Snapshots use git under the hood. The system auto-saves every 15 minutes,
so there's always a rollback point. Named snapshots let the user bookmark
specific versions.

## Available Scripts

### Create a named snapshot
```
bash .claude/skills/managing-snapshots/scripts/snapshot.sh "snapshot-name"
```

### List all snapshots
```
bash .claude/skills/managing-snapshots/scripts/list-snapshots.sh
```

### Rollback to a snapshot
```
bash .claude/skills/managing-snapshots/scripts/rollback.sh "snapshot-name"
```

## Manual Git Commands (when scripts aren't enough)
- View recent history: `git log --oneline -10`
- See what changed: `git diff HEAD~1`
- Undo last commit: `git reset --soft HEAD~1`
- Show a specific snapshot: `git show <tag-name>`

## Important Notes
- The system auto-saves every 15 minutes in the background
- Named snapshots stand out clearly in the history
- Rollback restores ALL files to the snapshot state
- Database files (.db, .sqlite) are included in snapshots
- node_modules is excluded via .gitignore
