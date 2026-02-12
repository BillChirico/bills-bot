# Feature: Channel Control Commands

**Version:** v2.0.0
**Status:** implemented
**Last Updated:** 2026-02-12

## Intent

Provide quick channel management commands for locking, unlocking, and setting
slowmode on text channels.

## Acceptance Criteria

- [x] `/lock` sets @everyone Send Messages permission to deny on the target channel
- [x] `/unlock` removes the @everyone Send Messages deny override
- [x] `/slowmode` sets the channel's rate limit (0 to disable, up to 21600s/6h)
- [x] All three default to the current channel if no channel option is provided
- [x] `/lock` and `/unlock` send a mod log embed
- [x] `/lock` and `/unlock` send an in-channel notification embed (non-ephemeral)
- [x] `/slowmode` replies ephemerally with confirmation
- [x] All commands require admin permission

## Implementation Notes

- `/unlock` sets `SendMessages` to `null` (reset) not `true` (explicit allow)
- `/slowmode` caps at 21600 seconds (6 hours) — Discord's hard limit
- `/slowmode` uses `parseDuration()` from `src/utils/duration.js` and converts ms → seconds

## Key Files

- `src/commands/lock.js`
- `src/commands/unlock.js`
- `src/commands/slowmode.js`
- `src/modules/moderation.js` — `sendModLogEmbed()`
- `src/utils/duration.js` — for slowmode duration parsing

## Command Options

| Command | Options |
|---------|---------|
| `/lock` | `channel` (Channel, optional), `reason` (String, optional) |
| `/unlock` | `channel` (Channel, optional), `reason` (String, optional) |
| `/slowmode` | `channel` (Channel, optional), `duration` (String, required — "0", "5s", "1m", "1h", etc.) |

## Requirements (EARS format)

- **FR-1:** When `/lock` is executed, the system SHALL edit the channel's permission overwrite for @everyone to deny `SendMessages`.
- **FR-2:** When `/unlock` is executed, the system SHALL remove the `SendMessages` deny override for @everyone (reset to null, not explicitly allow).
- **FR-3:** When `/slowmode` is executed with "0", the system SHALL set rate limit to 0 (disabled).
- **FR-4:** When `/slowmode` is executed with a duration, the system SHALL parse it and set `channel.setRateLimitPerUser(seconds)`.
- **FR-5:** When `/lock` or `/unlock` succeeds, the system SHALL send a visible embed in the channel ("🔒 Channel locked by @mod" / "🔓 Channel unlocked by @mod").
- **NFR-1:** The bot SHALL have Manage Channels permission; if missing, reply with a clear error.

## Dependencies

- `src/modules/moderation.js` — mod log posting
- `src/utils/duration.js` — duration parsing for slowmode
- Bot needs `ManageChannels` and `ManageRoles` permissions

## Out of Scope

- Server-wide lockdown (lock all channels)
- Voice channel muting
- Category-level locks
