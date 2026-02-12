# Feature: Purge Commands

**Version:** v2.0.0
**Status:** implemented
**Last Updated:** 2026-02-12

## Intent

Provide bulk message deletion with filtering via `/purge` subcommands.
All purge operations log to the mod log channel.

## Acceptance Criteria

- [x] `/purge all` deletes up to `count` messages (1–100) from the channel
- [x] `/purge user` deletes up to `count` messages from a specific user
- [x] `/purge bot` deletes up to `count` bot messages
- [x] `/purge contains` deletes messages containing a substring
- [x] `/purge links` deletes messages containing URLs
- [x] `/purge attachments` deletes messages with files/images
- [x] All subcommands respect Discord's 14-day bulk delete limit
- [x] All subcommands reply ephemerally with count of deleted messages
- [x] All subcommands send a mod log embed with purge details
- [x] All subcommands require admin permission

## Key Files

- `src/commands/purge.js`
- `src/modules/moderation.js` — `sendModLogEmbed()`

## Command Options

| Subcommand | Options |
|------------|---------|
| `/purge all` | `count` (Integer 1–100, required) |
| `/purge user` | `user` (User, required), `count` (Integer 1–100, required) |
| `/purge bot` | `count` (Integer 1–100, required) |
| `/purge contains` | `text` (String, required), `count` (Integer 1–100, required) |
| `/purge links` | `count` (Integer 1–100, required) |
| `/purge attachments` | `count` (Integer 1–100, required) |

## Requirements (EARS format)

- **FR-1:** When a moderator executes a purge subcommand, the system SHALL fetch up to `count` recent messages, apply the filter, and bulk-delete matches.
- **FR-2:** When messages older than 14 days are encountered, the system SHALL skip them (Discord API limitation).
- **FR-3:** After deletion, the system SHALL reply ephemerally with the count of deleted messages.
- **FR-4:** After deletion, the system SHALL send a mod log embed to the purges log channel.
- **NFR-1:** Purge SHALL use `channel.bulkDelete()` for efficiency (not individual deletes).

## Implementation Notes

- Fetch `count + 1` messages (to skip the interaction trigger if present).
- Filter in memory, then pass filtered collection to `bulkDelete()`.
- URL regex for links: `/https?:\/\/\S+/i`
- `bulkDelete()` returns a collection of deleted messages; use its size for the reply.
- Purge builds its own inline embed for the mod log (not `sendModLogEmbed()`)
  because purge doesn't create a case — it posts a custom embed directly to the
  purges/default log channel.
- Log posting failure is caught silently so the purge reply still succeeds.

## Dependencies

- `src/modules/moderation.js` — `sendModLogEmbed()`
- Mod log channel routing config

## Out of Scope

- Purge by role, by emoji, by date range (niche — deferred to backlog)
- Purge across multiple channels
