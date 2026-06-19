# Vivarium

An AI agent that lives inside a microsandbox microVM alongside your app. It has full access to the filesystem, the running process, and a browser — write code, run it, screenshot it, and auto-save to git. You talk to it from your phone; it builds while you do anything else.

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

The vivarium connects *outbound* to the hub via WebSocket — no port opening or firewall config needed. Your API key is never sent to the hub — it stays in your microVM and goes directly to Anthropic.

## Quick start

### Prerequisites

- An [Anthropic API key](https://console.anthropic.com/)
- A hub account (hosted at [app.vivarium.run](https://app.vivarium.run), or [self-host](https://github.com/assaf-benjosef/vivarium-hub))

### One-command install

```bash
curl -fsSL https://vivarium.run/install | bash -s -- --token <TOKEN>
```

This installs the [`@vivarium/cli`](https://github.com/assaf-benjosef/vivarium-cli) (`viv` command), which uses microsandbox to run the agent in a lightweight microVM.

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
- [vivarium-cli](https://github.com/assaf-benjosef/vivarium-cli) — the `viv` CLI for managing sandboxes
- [vivarium.run](https://vivarium.run) — landing page & waitlist

## License

MIT
