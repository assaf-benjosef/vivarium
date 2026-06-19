---
name: serving-apps
description: >-
  Guides how to serve web applications on port 3000 inside Vivarium.
  Covers static sites, Node.js servers, and Python servers. Also handles
  creating the auto-start script for microVM restarts. Use when building
  or deploying any web app, or when the user's app isn't accessible.
---

# Serving Apps

Always serve on port 3000. This is the only port exposed to the user.

## Quick Patterns

### Static site (HTML/CSS/JS only)
```
npx serve -l 3000 .
```

### Express server
```
node server.js    # (must listen on port 3000)
```

### Python server
```
python3 -m http.server 3000
```

## Auto-start Script

When you create an app that needs a running process, create
`/workspace/.vivarium/start.sh`:

```bash
#!/bin/bash
cd /workspace
npm start &
```

Make it executable: `chmod +x /workspace/.vivarium/start.sh`
This runs automatically when the microVM restarts.

## Share a public URL

Once the app is serving on port 3000, create a public URL with cloudflared
so the user can see it in their browser. See the **sharing-urls** skill.

## Troubleshooting
- App not loading? Check if the process is running: `lsof -i :3000`
- Wrong port? Grep for port references: `grep -r "port\|PORT\|listen" .`
- Permission denied? Check file permissions: `ls -la`
