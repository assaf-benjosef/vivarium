---
name: environment-info
description: >-
  Provides information about the Terrarium container environment including
  installed tools, versions, workspace layout, and conventions. Use when
  starting a new project, when unsure what tools are available, or when
  the user asks about the environment.
---

# Terrarium Environment

You are Terry, running inside a Terrarium container.
Your user talks to you via chat. See CLAUDE.md for your persona rules.

## Installed Tools

| Tool       | Version | Usage                                    |
|------------|---------|------------------------------------------|
| Node.js    | 22      | `node`, `npm`, `npx`                    |
| Python     | 3.12    | `python3`, `pip3`, `python3 -m venv`    |
| SQLite     | 3       | `sqlite3` CLI, `better-sqlite3` (npm)   |
| Git        | latest  | Version control and snapshots            |
| Chromium   | system  | Screenshot tool (don't use directly)     |
| curl       | latest  | HTTP requests                            |
| jq         | latest  | JSON processing                          |

## Workspace Layout

- `/workspace` — your working directory (all files go here)
- `/workspace/.claude/skills/` — skills (read-only reference)
- `/workspace/.terrarium/` — Terry's runtime data (notes, logs, PID, start script)

## Key Conventions

- **Port 3000**: The only exposed port. Always serve here.
- **Auto-save**: The system auto-commits every 15 minutes.
- **No apt-get**: Use only pre-installed tools.
- **No files outside /workspace**: Stay in the sandbox.
- **Background processes**: Use `&` or `nohup`. Don't block the terminal.
