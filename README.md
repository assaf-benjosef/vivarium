# 🌱 Terrarium

A curated Docker environment that turns an AI agent into a personal app developer you talk to on Telegram.

Tell Terry what you want. Terry builds it, shows you a screenshot, and keeps it running. No coding required.

## How it works

```
You:   "Build me a family chore tracker"
Terry: ✅ Done! Here's how it looks:
       📸 [screenshot]
       🌐 http://your-server:3000

You:   "Make it darker and add a search bar"
Terry: ✅ Updated!
       📸 [screenshot]

You:   "Save this as v1"
Terry: 💾 Saved!
```

Terry is an AI agent (Claude) running inside a Docker container with everything pre-installed — Node.js, Python, SQLite, Chromium, git. You chat with Terry on Telegram. Terry writes the code, serves the app, takes screenshots, manages versions, and fixes problems — all without you ever touching a terminal.

## What's inside

| Layer | What it does |
|---|---|
| **CLAUDE.md** | Terry's persona — friendly, no jargon, proactive |
| **Skills** | 6 SKILL.md files teaching Terry how to build, serve, snapshot, and diagnose |
| **Glue code** | ~360 lines of TypeScript connecting Telegram → Claude Agent SDK |
| **Docker** | Node 22, Python 3, SQLite, Chromium, git — all pre-installed |

### Skills

| Skill | Purpose |
|---|---|
| `writing-notes` | Terry's memory — persists architecture, preferences, and decisions across sessions |
| `building-quality-apps` | Logging, error handling, health endpoints — so Terry can self-diagnose |
| `serving-apps` | Always serve on port 3000, auto-start on container restart |
| `managing-snapshots` | Git-based save/undo/rollback with named versions |
| `taking-screenshots` | Headless Chromium screenshots after every visual change |
| `managing-databases` | SQLite patterns and best practices |
| `environment-info` | What tools are available in the container |

## Quick start

### Prerequisites

- Docker
- A [Telegram bot token](https://core.telegram.org/bots#creating-a-new-bot) (talk to [@BotFather](https://t.me/BotFather))
- An [Anthropic API key](https://console.anthropic.com/)

### Run

```bash
docker build -t terrarium .

docker run -d \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e TELEGRAM_BOT_TOKEN=123456:ABC... \
  -e ALLOWED_USERS=your_telegram_id \
  -v terrarium-data:/workspace \
  -p 3000:3000 \
  --name terry \
  terrarium
```

Then open Telegram and message your bot. Terry will introduce himself.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Your Anthropic API key |
| `TELEGRAM_BOT_TOKEN` | ✅ | Telegram bot token from BotFather |
| `ALLOWED_USERS` | | Comma-separated Telegram user IDs (empty = allow all) |
| `MAX_TURNS` | | Max agent turns per message (default: 30) |
| `MODEL` | | Claude model to use (default: `claude-sonnet-4-20250514`) |

## Architecture

```
Telegram → grammY bot → Claude Agent SDK → /workspace
                                              ├── .claude/skills/  (Terry's brain)
                                              ├── .terrarium/      (notes, logs, PID)
                                              └── [your app files]
```

- **Skills** load on-demand via the Agent SDK's skill discovery
- **CLAUDE.md** is always in context — defines Terry's communication style
- **Auto-save** commits changes every 15 minutes via git
- **Named snapshots** are git tags created on user request

## For non-technical users

Terry is designed for people who don't code. He:

- Never uses jargon (no "port 3000" or "npm install")
- Shows screenshots instead of describing changes
- Asks before making big changes
- Fixes problems silently when possible
- Remembers your preferences across conversations

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally (needs env vars)
npm run dev
```

## License

MIT
