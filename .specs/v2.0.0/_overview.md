# v2.0.0 — Moderation Command Suite

**Status:** implemented
**Last Updated:** 2026-02-12

## Intent

Add a comprehensive interactive moderation toolkit to bills-bot, replacing the
current spam-detection-only approach with full case-tracked moderation commands,
configurable logging, auto-escalation, and channel controls.

## Feature Matrix

| Feature | Spec | Status |
|---------|------|--------|
| Core actions (warn, kick, timeout, ban, etc.) | `moderation-core.md` | implemented |
| Purge subcommands | `moderation-purge.md` | implemented |
| Case system + /history | `moderation-cases.md` | implemented |
| Channel control (lock, unlock, slowmode) | `moderation-channels.md` | implemented |
| Mod log routing + /modlog commands | `moderation-logging.md` | implemented |
| Auto-escalation, DM notifications, tempban scheduler | `moderation-escalation.md` | implemented |

## Architecture Decisions

1. **Hybrid command grouping** — flat top-level for frequent actions (warn, kick,
   ban), subcommands for compound features (purge, case, modlog).
2. **Shared module** — `src/modules/moderation.js` centralizes case creation,
   DM notifications, mod log posting, and escalation checks.
3. **Database** — two new tables (`mod_cases`, `mod_scheduled_actions`) added
   via `initDb()` in `src/db.js`.
4. **Config extension** — `moderation` section gains `dmNotifications`,
   `escalation`, and `logging` sub-objects.
5. **Permissions** — all mod commands → `"admin"` in `permissions.allowedCommands`.
6. **Duration parsing** — new `src/utils/duration.js` utility (parse + format).
7. **Tempban scheduler** — polling interval (60s) in `src/modules/moderation.js`,
   wired into startup in `src/index.js`.

## New Files

| File | Purpose |
|------|---------|
| `src/utils/duration.js` | Parse "1h"/"7d" → ms, format ms → human |
| `src/modules/moderation.js` | Case creation, DM, log posting, escalation, scheduler |
| `src/commands/warn.js` | /warn command |
| `src/commands/kick.js` | /kick command |
| `src/commands/timeout.js` | /timeout command |
| `src/commands/untimeout.js` | /untimeout command |
| `src/commands/ban.js` | /ban command |
| `src/commands/tempban.js` | /tempban command |
| `src/commands/unban.js` | /unban command |
| `src/commands/softban.js` | /softban command |
| `src/commands/purge.js` | /purge subcommands |
| `src/commands/case.js` | /case subcommands |
| `src/commands/history.js` | /history command |
| `src/commands/lock.js` | /lock command |
| `src/commands/unlock.js` | /unlock command |
| `src/commands/slowmode.js` | /slowmode command |
| `src/commands/modlog.js` | /modlog subcommands + component handlers |

## Database Tables

- `mod_cases` — case records (see `moderation-cases.md`)
- `mod_scheduled_actions` — tempban scheduler queue (see `moderation-escalation.md`)

## Dependencies

- discord.js v14 (existing)
- pg (existing)
- No new npm dependencies required
