---
name: deploying-with-ngrok
description: >-
  Guides how to expose the web application running on port 3000 to the public internet using ngrok. Use this when the user asks to "deploy", "share", or "expose" their app.
---

# Deploying with ngrok

You can expose the locally running app (which is always on port 3000) to the public internet using ngrok. 

## Requirements

The user must have provided their ngrok auth token via the `NGROK_AUTHTOKEN` environment variable when starting the container. You can check if it exists:

```bash
echo $NGROK_AUTHTOKEN
```

If it is empty or missing, tell the user they need to restart the container with `-e NGROK_AUTHTOKEN=their_token` to use this feature.

## Exposing the App

Start ngrok in the background pointing to port 3000, and output its logs to a file:

```bash
ngrok http 3000 > /workspace/.terrarium/ngrok.log &
```

Wait a few seconds for it to connect, then fetch the public URL:

```bash
curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url'
```

Share this `public_url` with the user! Tell them this link will stay active as long as the container is running and ngrok isn't interrupted.

## Stopping ngrok

If you need to stop ngrok (e.g. to restart it):
```bash
pkill ngrok
```
