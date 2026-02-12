# Feature: Auto-Escalation, DM Notifications & Tempban Scheduler

**Version:** v2.0.0
**Status:** implemented
**Last Updated:** 2026-02-12

## Intent

Provide configurable auto-escalation (warn thresholds trigger automatic actions),
DM notifications before moderation actions, and a tempban scheduler for automatic
unbans.

## Acceptance Criteria

- [x] DM notifications are sent before executing kick/ban (user can't receive DMs after)
- [x] DM notifications are independently toggleable per action type
- [x] DM includes: server name, action type, reason (or "No reason provided")
- [x] DM failures are silently caught (user has DMs closed)
- [x] Auto-escalation checks run after every `/warn`
- [x] Escalation thresholds are configurable (warn count, time window, action, duration)
- [x] Escalation creates its own case referencing the threshold
- [x] Tempban scheduler polls every 60 seconds for expired bans
- [x] Scheduler runs on startup, catching up on missed unbans
- [x] Scheduler marks actions as executed after processing

## Implementation Notes

- `shouldSendDm()` maps action types to config keys (tempban/softban → 'ban' toggle)
- Escalation uses `parseDuration()` for timeout durations from threshold config
- Scheduler uses `setInterval(60000)` stored in module scope; `stopTempbanScheduler()` clears it
- Scheduler is started after `registerEventHandlers()` in `src/index.js`
- Scheduler is stopped before pool close in graceful shutdown

## Key Files

- `src/modules/moderation.js` — `sendDmNotification()`, `checkEscalation()`, `startTempbanScheduler()`, `stopTempbanScheduler()`
- `src/index.js` — scheduler startup + shutdown wiring
- `src/db.js` — `mod_scheduled_actions` table

## Schema / Data Model

Reference: `src/db.js` — `mod_scheduled_actions` table

```sql
CREATE TABLE IF NOT EXISTS mod_scheduled_actions (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT NOT NULL,
  case_id INTEGER REFERENCES mod_cases(id),
  execute_at TIMESTAMPTZ NOT NULL,
  executed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Index: `(executed, execute_at)`.

## Config Structure

Reference: `config.json` → `moderation.dmNotifications`, `moderation.escalation`

```json
"dmNotifications": {
  "warn": true,
  "timeout": true,
  "kick": true,
  "ban": true
},
"escalation": {
  "enabled": false,
  "thresholds": [
    { "warns": 3, "withinDays": 7, "action": "timeout", "duration": "1h" },
    { "warns": 5, "withinDays": 30, "action": "ban" }
  ]
}
```

## DM Notification Format

```
**You have been {action} in {serverName}**
Reason: {reason || "No reason provided"}
```

Actions mapped to past tense: warn→warned, kick→kicked, timeout→timed out,
ban→banned, tempban→temporarily banned.

## Escalation Logic

```
function checkEscalation(guildId, targetId, config):
  if !config.moderation.escalation.enabled: return null
  for each threshold in config.moderation.escalation.thresholds:
    count = SELECT COUNT(*) FROM mod_cases
            WHERE guild_id = $1 AND target_id = $2
            AND action = 'warn'
            AND created_at > NOW() - INTERVAL '$withinDays days'
    if count >= threshold.warns:
      execute escalation action (timeout or ban)
      create case with reason "Auto-escalation: {count} warns in {withinDays} days"
      return escalation result
  return null
```

Thresholds are evaluated in order; first match wins.

## Tempban Scheduler Logic

```
function pollTempbans():
  rows = SELECT * FROM mod_scheduled_actions
         WHERE executed = FALSE AND execute_at <= NOW()
  for each row:
    try:
      guild.members.unban(row.target_id, "Tempban expired")
      UPDATE mod_scheduled_actions SET executed = TRUE WHERE id = row.id
      create unban case referencing original tempban case
    catch:
      log error, continue to next
```

## Requirements (EARS format)

- **FR-1:** When a moderation action is about to execute AND DM notifications are enabled for that action type, the system SHALL send a DM to the target before the Discord API call.
- **FR-2:** When the DM fails (user has DMs disabled), the system SHALL catch the error silently and proceed with the action.
- **FR-3:** When a `/warn` completes, the system SHALL evaluate escalation thresholds in order; on the first match, execute the escalation action.
- **FR-4:** When escalation triggers, the system SHALL create a separate case with an auto-escalation reason.
- **FR-5:** When a tempban is created, the system SHALL insert a row into `mod_scheduled_actions` with `execute_at` set to `NOW() + duration`.
- **FR-6:** The tempban scheduler SHALL poll every 60 seconds for rows where `executed = FALSE AND execute_at <= NOW()`.
- **FR-7:** When the bot starts, the scheduler SHALL immediately check for missed unbans.
- **NFR-1:** Scheduler polling SHALL NOT block the event loop.

## Dependencies

- `mod_cases` table
- `mod_scheduled_actions` table
- `src/modules/moderation.js`
- `src/utils/duration.js`
- Discord client reference (for unban API calls)

## Out of Scope

- Appeal system
- Escalation cooldowns
- Escalation based on non-warn actions
- Custom escalation chains (only warn → action)
