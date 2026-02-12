# Feature: Core Moderation Commands

**Version:** v2.0.0
**Status:** implemented
**Last Updated:** 2026-02-12

## Intent

Provide flat top-level slash commands for the 8 most common moderation actions.
Every action creates a case, sends a mod log embed, and optionally DMs the target.

## Acceptance Criteria

- [x] `/warn` issues a warning (case only, no Discord API action)
- [x] `/kick` removes the user from the server
- [x] `/timeout` applies a Discord native timeout (up to 28 days)
- [x] `/untimeout` removes an active timeout
- [x] `/ban` permanently bans the user with optional message deletion (0–7 days)
- [x] `/tempban` bans with auto-unban scheduled for after `duration`
- [x] `/unban` unbans by user ID
- [x] `/softban` bans + immediate unban (purges recent messages)
- [x] Every action creates a `mod_cases` row via `createCase()`
- [x] Every action sends a mod log embed via `sendModLogEmbed()`
- [x] Warn, kick, timeout, ban DM the target before execution (if enabled)
- [x] `/warn` triggers `checkEscalation()` after case creation
- [x] All commands require `adminOnly: true` / `"admin"` permission
- [x] All commands reply ephemerally on success with case number
- [x] All commands handle errors gracefully (missing permissions, user not found)
- [x] Hierarchy check: cannot moderate users with equal/higher roles

## Implementation Notes

- All 8 commands follow the same pattern: defer → validate → execute action → createCase → DM → log → reply
- `checkHierarchy()` compares `member.roles.highest.position` values
- `shouldSendDm()` reads config toggle per action type
- Tempban inserts into both `mod_cases` and `mod_scheduled_actions`

## Key Files

- `src/commands/warn.js`
- `src/commands/kick.js`
- `src/commands/timeout.js`
- `src/commands/untimeout.js`
- `src/commands/ban.js`
- `src/commands/tempban.js`
- `src/commands/unban.js`
- `src/commands/softban.js`
- `src/modules/moderation.js` (shared logic)
- `src/utils/duration.js` (for timeout/tempban)

## Command Options

| Command | Options |
|---------|---------|
| `/warn` | `user` (User, required), `reason` (String, optional) |
| `/kick` | `user` (User, required), `reason` (String, optional) |
| `/timeout` | `user` (User, required), `duration` (String, required), `reason` (String, optional) |
| `/untimeout` | `user` (User, required), `reason` (String, optional) |
| `/ban` | `user` (User, required), `reason` (String, optional), `delete_messages` (Integer 0–7, optional) |
| `/tempban` | `user` (User, required), `duration` (String, required), `reason` (String, optional), `delete_messages` (Integer 0–7, optional) |
| `/unban` | `user_id` (String, required), `reason` (String, optional) |
| `/softban` | `user` (User, required), `reason` (String, optional), `delete_messages` (Integer 0–7, optional, default 7) |

## Requirements (EARS format)

- **FR-1:** When a moderator executes any core action, the system SHALL create a case in `mod_cases`.
- **FR-2:** When a moderator executes any core action, the system SHALL send a mod log embed to the configured channel.
- **FR-3:** When DM notifications are enabled for the action type, the system SHALL DM the target before executing the Discord API action.
- **FR-4:** When `/warn` completes, the system SHALL call `checkEscalation()` to evaluate auto-escalation thresholds.
- **FR-5:** When the target has an equal or higher top role than the moderator, the system SHALL reject the action.
- **NFR-1:** Command execution SHALL complete within 3 seconds under normal conditions.

## Dependencies

- `src/modules/moderation.js` — `createCase()`, `sendDmNotification()`, `sendModLogEmbed()`, `checkEscalation()`
- `src/utils/duration.js` — duration parsing for timeout/tempban
- `mod_cases` table in database
- `mod_scheduled_actions` table (for tempban)

## Out of Scope

- `/note` command (deferred to backlog)
- Mute role system (native timeout covers it)
- Bulk moderation actions
