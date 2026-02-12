# Feature: Mod Log Routing & Configuration

**Version:** v2.0.0
**Status:** implemented
**Last Updated:** 2026-02-12

## Intent

Route moderation events to configurable Discord channels with rich embeds.
Provide `/modlog` commands for setup, viewing, and disabling log routing.

## Acceptance Criteria

- [x] Mod log embeds are sent to the correct channel based on event type
- [x] If a type-specific channel is not set, the `default` channel is used
- [x] If no default channel is set, mod log posting silently skips
- [x] `/modlog setup` presents an interactive flow (StringSelectMenu → ChannelSelectMenu)
- [x] `/modlog view` shows current channel routing as an embed
- [x] `/modlog disable` clears all mod log channel config
- [x] Embeds include: case #, action type (with color coding), target, moderator, reason, timestamp
- [x] All `/modlog` commands require admin permission

## Implementation Notes

- Component interactions are handled inline via `createMessageComponentCollector()` on the
  reply message, not via a global interaction handler in `src/index.js`
- Collector has a 5-minute timeout; "Done" button stops it immediately
- `/modlog disable` sets all channel values to the string `'null'` via `setConfigValue()`
- Log message editing on case reason updates is implemented in `/case reason` (not deferred)

## Key Files

- `src/commands/modlog.js`
- `src/modules/moderation.js` — `sendModLogEmbed()`
- `src/index.js` — component interaction handler for select menus

## Embed Color Scheme

| Action | Color |
|--------|-------|
| warn | `0xfee75c` (yellow) |
| kick | `0xed4245` (red) |
| timeout | `0xe67e22` (orange) |
| untimeout | `0x57f287` (green) |
| ban | `0xed4245` (red) |
| tempban | `0xed4245` (red) |
| unban | `0x57f287` (green) |
| softban | `0xed4245` (red) |
| purge | `0x5865f2` (blurple) |
| lock | `0xe67e22` (orange) |
| unlock | `0x57f287` (green) |

## Config Structure

Reference: `config.json` → `moderation.logging`

```json
"logging": {
  "channels": {
    "default": null,
    "warns": null,
    "bans": null,
    "kicks": null,
    "timeouts": null,
    "purges": null,
    "locks": null
  }
}
```

## /modlog setup Flow

1. Bot sends embed with StringSelectMenu listing event categories (warns, bans, kicks, timeouts, purges, locks, default)
2. User selects a category
3. Bot updates embed with ChannelSelectMenu
4. User selects a channel
5. Bot saves mapping to config via `setConfigValue()`
6. Bot updates embed to confirm, returns to step 1 for more mappings
7. User clicks "Done" button to finish

## Requirements (EARS format)

- **FR-1:** When `sendModLogEmbed()` is called, it SHALL resolve the target channel by checking the action-specific channel first, then the default channel.
- **FR-2:** When no channel is configured for an event type and no default exists, the system SHALL silently skip log posting.
- **FR-3:** When `/modlog setup` is executed, the system SHALL present an interactive embed with a StringSelectMenu of event categories.
- **FR-4:** When a user selects a category and channel, the system SHALL save the mapping via `setConfigValue()`.
- **FR-5:** When `/modlog view` is executed, the system SHALL display all current channel mappings.
- **FR-6:** When `/modlog disable` is executed, the system SHALL set all logging channel values to null.
- **NFR-1:** Component interactions SHALL use custom IDs prefixed with `modlog_` to avoid collisions.

## Dependencies

- `src/modules/config.js` — `setConfigValue()`, `getConfig()`
- `src/index.js` — no global wiring needed (collector is inline)

## Out of Scope

- Audit log integration (reading Discord's native audit log)
- Log message editing on case reason updates (tracked in cases spec)
- Log retention/cleanup
