# Vivarium — Agent Context

## What this is

The Vivarium agent runtime. A Node.js/TypeScript process that runs inside a microVM (SmolVM) or Docker container alongside the user's app. It receives messages from the hub via WebSocket, drives Claude via the Agent SDK, and has full access to the app's filesystem, process, and a Chromium browser for screenshots.

## Architecture

```
src/
  index.ts          — Entry point: container setup, auto-save loop, WebSocket + Agent wiring
  config.ts         — Env var loading and validation
  agent/
    runner.ts       — AgentRunner: drives Claude Agent SDK, manages turns and conversation
    tools.ts        — Custom tools: screenshot, app restart, file operations
  ws/
    client.ts       — HubConnection: WebSocket client with auto-reconnect
    protocol.ts     — Message types shared with the hub
skills/             — Markdown instruction files copied into /workspace/.claude/skills/
workspace-template/ — Default CLAUDE.md for new workspaces
scripts/            — Setup scripts for SmolVM and Docker deployment
```

## Key patterns

- The agent connects **outbound** to the hub — no inbound ports needed
- Auto-save commits to git every 15 minutes (`/workspace` is always a git repo)
- Skills are persistent markdown instructions in `/workspace/.claude/skills/`
- The app always runs on port 3000 inside the container
- Screenshots use Puppeteer with Chromium (headless)
- SmolVM runtime uses `smolvm pack` format (v0.1.7+); Docker is the fallback

## Environment

- Runtime: Node.js 22+ (ESM, TypeScript compiled to JS)
- Build: `npm run build` → `tsc` → `dist/`
- Tests: `npm test` → Vitest
- Key deps: `@anthropic-ai/claude-agent-sdk`, `ws`, `puppeteer-core`, `zod`

## Conventions

- Inline styles (no CSS framework)
- Config via environment variables, validated with zod in `config.ts`
- Structured logging with ISO timestamps to stdout
- No database — state lives in git (workspace) and the hub (message history)
- WebSocket protocol is JSON messages defined in `ws/protocol.ts`

## Related repo

- [vivarium-hub](https://github.com/assaf-benjosef/vivarium-hub) — the message broker, web console, and landing page
