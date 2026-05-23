---
name: building-quality-apps
description: >-
  Software engineering principles for building reliable Vivarium apps.
  Covers error handling, logging, health checks, and defensive coding.
  Use when creating or modifying any app to ensure it runs reliably
  without user intervention.
---

# Building Quality Apps

The user can't debug anything. Your apps must be self-healing and
well-instrumented so YOU can diagnose problems.

## Logging

Always set up structured logging to a file:

```javascript
const fs = require('fs');
const logFile = '/workspace/.vivarium/app.log';

function log(level, msg, data = {}) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...data
  });
  fs.appendFileSync(logFile, entry + '\n');
  if (level === 'error') console.error(msg);
}
```

Log to `/workspace/.vivarium/app.log` so you can read it later
when diagnosing issues.

## Error Handling

### Express apps
```javascript
// Catch all unhandled errors
app.use((err, req, res, next) => {
  log('error', 'Request failed', { path: req.path, error: err.message });
  res.status(500).send('Something went wrong. Viv is on it.');
});

// Catch unhandled rejections
process.on('unhandledRejection', (reason) => {
  log('error', 'Unhandled rejection', { reason: String(reason) });
});

process.on('uncaughtException', (err) => {
  log('error', 'Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1); // Let start.sh restart it
});
```

### User-facing error pages
Never show stack traces. Show a friendly message:
"Something went wrong. Don't worry — Viv will fix this."

## Health Check

Add a `/health` endpoint to every app:

```javascript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});
```

This lets you check if the app is responding when investigating issues.

## Startup Script

Always create `/workspace/.vivarium/start.sh` that:
1. Redirects stdout/stderr to the log file
2. Runs the app in the background
3. Handles restart gracefully

```bash
#!/bin/bash
cd /workspace
echo "Starting app at $(date)" >> .vivarium/app.log
node server.js >> .vivarium/app.log 2>&1 &
echo $! > .vivarium/app.pid
```

## Where Things Live

When something goes wrong, you already have Bash — just investigate.
Here's where to look:

| What | Where |
|---|---|
| App log | `.vivarium/app.log` |
| Process PID | `.vivarium/app.pid` |
| Startup script | `.vivarium/start.sh` |
| Your notes | `.vivarium/NOTES.md` |
| Database files | `*.db` or `*.sqlite` in `/workspace` |
| Port 3000 | `lsof -i :3000` |
| Recent changes | `git log --oneline -5` |

## Database Safety
- Always use `CREATE TABLE IF NOT EXISTS`
- Use WAL mode: `PRAGMA journal_mode=WAL;`
- Handle constraint errors gracefully
- Back up before schema migrations
