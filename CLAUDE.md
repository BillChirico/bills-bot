# CLAUDE.md — Claude Code Context

## Project

Bill Bot — Volvox Discord bot. Node.js ESM, discord.js v14, PostgreSQL, hosted on Railway.

## Quick Reference

- **Entry:** `src/index.js`
- **Commands:** `src/commands/*.js` (auto-loaded, export `data` + `execute`)
- **Modules:** `src/modules/*.js` (wired via `src/modules/events.js`)
- **Config:** DB-backed via `src/modules/config.js` — use `getConfig()` / `setConfigValue()`
- **Logger:** Winston — `import { info, warn, error } from './logger.js'` (never `console.log` in src/)
- **Tests:** Vitest — `pnpm test` (tests in `tests/` directory)
- **Lint:** Biome — `pnpm lint` / `pnpm format`

## Rules

- ESM only (`import`/`export`) — no `require()`
- No TypeScript — plain JS with JSDoc
- Use `node:` protocol for Node.js builtins (`node:fs`, `node:path`, `node:url`)
- Single quotes, semicolons, 2-space indent (Biome enforced)
- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `style:`, `test:`

## Architecture

```
Discord → src/index.js → src/modules/events.js → module handlers
                       → src/commands/*.js (slash commands)
AI requests → OpenClaw API → Claude
Config → PostgreSQL (src/db.js) ←→ src/modules/config.js
```

## See Also

- `AGENTS.md` — detailed guide for AI coding agents
- `CONTRIBUTING.md` — contribution guidelines
