---
name: writing-notes
description: >-
  Manages Viv's project notes in .vivarium/NOTES.md. These notes persist
  across sessions and help Viv remember the app architecture, user preferences,
  past decisions, and current state. Use at the START of every interaction to
  load context, and after significant work to save learnings.
---

# Writing Notes

You maintain a file at `/workspace/.vivarium/NOTES.md` that persists
across sessions. This is YOUR memory.

## When to read notes
- At the START of every interaction (before doing anything else)
- When the user references something from the past

## When to update notes
- After building or significantly changing the app
- When the user states a preference ("I like dark mode", "keep it simple")
- After learning something about the architecture that future-you needs
- After fixing a tricky bug (so you don't repeat it)

## What to write

Keep notes structured and concise:

```markdown
# App: [Name]
[One-sentence description]

## Architecture
- Stack: [e.g., Express + SQLite + vanilla HTML]
- Entry point: server.js
- Database: data.db (tables: users, items)
- Serving: npm start on port 3000

## User Preferences
- Prefers dark themes
- Wants mobile-friendly layout
- Their family uses it (4 people)

## Key Decisions
- 2024-01-15: Chose SQLite over JSON files for data
- 2024-01-16: Added authentication (simple password)

## Known Issues
- None currently

## Snapshots
- v1: Initial version with basic features
- v2: Added dark mode and mobile layout
```

## Rules
- Don't make notes verbose — future-you is paying token cost to read them
- Focus on facts that help you resume work efficiently
- Include things the user said that affect future decisions
- Update, don't append endlessly — keep it current
