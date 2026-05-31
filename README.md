# Vivarium

An AI agent that lives inside a microVM or Docker container alongside your app. It has full access to the filesystem, the running process, and a browser — write code, run it, screenshot it, and auto-save to git. You talk to it from your phone; it builds while you do anything else.

## How it works

```
You (phone):  "Build me a tip calculator"
Vivarium:     Done! Here's a screenshot:
              📸 [screenshot of running app]
              Live at :3000, pushed to git.

You:          "Make the split stepper bigger"
Vivarium:     Updated — bumped hit targets to 48px.
              📸 [screenshot]
```

The agent lives *with* your app — same VM, same filesystem, same network. It doesn't remote in; it's already there.

## Architecture

```
You (chat) ──→ vivarium-hub (message broker) ──→ WebSocket ──→ Vivarium (this repo)
                                                                    │
                                                                    ├── Claude Agent SDK
                                                                    ├── /workspace (git repo + your app)
                                                                    ├── Chromium (screenshots)
                                                                    └── App running on :3000
```

The vivarium connects *outbound* to the hub via WebSocket — no port opening or firewall config needed. Your API key never leaves your machine.

## Quick start

### Prerequisites

- Docker (or SmolVM)
- A running [vivarium-hub](https://github.com/assaf-benjosef/vivarium-hub)
- An [Anthropic API key](https://console.anthropic.com/)

### One-command install (SmolVM)

```bash
curl -fsSL https://raw.githubusercontent.com/assaf-benjosef/vivarium/main/scripts/setup.sh | bash
```

### Docker

```bash
docker build -t vivarium .

docker run -d \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e HUB_URL=wss://your-hub:8080/ws \
  -e HUB_TOKEN=eyJ... \
  -e VIVARIUM_NAME=my-app \
  -v vivarium-data:/workspace \
  -p 3000:3000 \
  --name vivarium \
  vivarium
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Your Anthropic API key |
| `HUB_URL` | ✅ | WebSocket URL of your hub (e.g. `wss://hub.example.com/ws`) |
| `HUB_TOKEN` | ✅ | JWT token from the hub |
| `VIVARIUM_NAME` | | Name for this vivarium (default: `my-vivarium`) |
| `MAX_TURNS` | | Max agent turns per message (default: 30) |
| `MODEL` | | Claude model (default: `claude-sonnet-4-5`) |

## What's inside

- **Agent runner** (`src/agent/runner.ts`) — drives Claude via the Agent SDK, manages conversation turns
- **Tools** (`src/agent/tools.ts`) — screenshot, app-restart, and other capabilities
- **WebSocket client** (`src/ws/client.ts`) — connects to the hub, handles reconnection
- **Skills** (`skills/`) — persistent instructions that teach the agent how to serve apps, take screenshots, manage git, etc.
- **Auto-save** — commits to git every 15 minutes so nothing is lost

## Development

```bash
npm install
npm run build
npm test
npm run dev   # needs ANTHROPIC_API_KEY, HUB_URL, HUB_TOKEN
```

## Related

- [vivarium-hub](https://github.com/assaf-benjosef/vivarium-hub) — message broker + web console
- [vivarium.run](https://vivarium.run) — landing page & waitlist

## License

MIT
