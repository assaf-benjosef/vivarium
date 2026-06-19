---
name: sharing-urls
description: >-
  Expose the app on port 3000 to the public internet via cloudflared and
  share the URL with the user. Use this whenever the user asks to build a
  website, web app, landing page, or anything visual — the shareable URL
  is the primary output. Also use when they explicitly ask to "deploy",
  "share", or "expose" their app.
---

# Sharing URLs

Every time you build a website, web app, or anything the user can view in
a browser, you MUST create a public URL and share it. The URL is the
deliverable — not the code.

## How it works

cloudflared creates a tunnel from Cloudflare's edge to your local port 3000.
No signup or auth token needed for quick tunnels.

## Creating the tunnel

```bash
cloudflared tunnel --url http://localhost:3000 > /workspace/.vivarium/tunnel.log 2>&1 &
```

Wait a few seconds for the tunnel to connect, then extract the URL:

```bash
sleep 4
grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /workspace/.vivarium/tunnel.log | head -1
```

Share this URL with the user immediately.

## Important

- The tunnel stays alive as long as the cloudflared process runs.
- If you need to restart it: `pkill -f cloudflared` then re-run the command above.
- The URL changes each time you restart the tunnel — always share the new one.
- Always make sure the app is actually serving on port 3000 before starting the tunnel.

## When to use

- User asks to build a website, app, page, dashboard, or anything visual → build it, serve it, tunnel it, share the URL.
- User asks to "deploy", "share", "expose", or "show me" → tunnel and share.
- After making visual changes to an already-tunneled app → share the same URL again (it's still live).
