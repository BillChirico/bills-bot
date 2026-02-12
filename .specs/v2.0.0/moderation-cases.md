# Feature: Case System & History

**Version:** v2.0.0
**Status:** implemented
**Last Updated:** 2026-02-12

## Intent

Track all moderation actions as numbered cases in PostgreSQL. Provide commands
to view, list, edit, and delete cases, plus a flat `/history` shortcut for
per-user history.

## Acceptance Criteria

- [x] Cases are auto-numbered per guild (sequential, starting at 1)
- [x] `/case view` displays a single case by number as an embed
- [x] `/case list` shows recent cases with optional user/type filters
- [x] `/case reason` updates the reason on an existing case
- [x] `/case delete` removes a case (hard delete)
- [x] `/history` shows all cases for a specific user (last 25, not paginated)
- [x] Case embeds show: case #, action type, target, moderator, reason, timestamp, duration (if applicable)

## Implementation Notes

- `/case delete` performs a hard DELETE, not a soft delete
- `/history` shows the last 25 cases without pagination (simple truncation)
- `/case reason` edits the mod log embed message when `log_message_id` is stored;
  failures are caught gracefully
- Case number generation uses `COALESCE(MAX(case_number), 0) + 1` pattern

## Key Files

- `src/commands/case.js`
- `src/commands/history.js`
- `src/modules/moderation.js` — `getNextCaseNumber()`, `createCase()`
- `src/db.js` — `mod_cases` table

## Schema / Data Model

Reference: `src/db.js` — `mod_cases` table

```sql
CREATE TABLE IF NOT EXISTS mod_cases (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  case_number INTEGER NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_tag TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  moderator_tag TEXT NOT NULL,
  reason TEXT,
  duration TEXT,
  expires_at TIMESTAMPTZ,
  log_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guild_id, case_number)
);
```

Indexes: `(guild_id, target_id, created_at)`, `(guild_id, case_number)`.

## Command Options

| Subcommand | Options |
|------------|---------|
| `/case view` | `case_id` (Integer, required) |
| `/case list` | `user` (User, optional), `type` (String choice, optional) |
| `/case reason` | `case_id` (Integer, required), `reason` (String, required) |
| `/case delete` | `case_id` (Integer, required) |
| `/history` | `user` (User, required) |

## Requirements (EARS format)

- **FR-1:** When `getNextCaseNumber(guildId)` is called, it SHALL return `MAX(case_number) + 1` for that guild, or 1 if no cases exist.
- **FR-2:** When `/case view` is executed, the system SHALL query `mod_cases` by guild_id and case_number and display an embed.
- **FR-3:** When `/case list` is executed with no filters, the system SHALL return the 10 most recent cases for the guild.
- **FR-4:** When `/case list` is executed with a user filter, the system SHALL return cases where `target_id` matches.
- **FR-5:** When `/case reason` is executed, the system SHALL update the reason column and also edit the mod log embed message if `log_message_id` is stored.
- **FR-6:** When `/case delete` is executed, the system SHALL delete the row from `mod_cases`.
- **FR-7:** When `/history` is executed, the system SHALL return all cases for the target user in the guild, newest first.
- **NFR-1:** Case number generation SHALL be safe under concurrent access (use `SELECT ... FOR UPDATE` or equivalent).

## Dependencies

- `mod_cases` table
- `src/modules/moderation.js`

## Out of Scope

- Case notes/comments (deferred)
- Case export (CSV/JSON)
- Pagination beyond 10 results for `/case list` (simple truncation for v2)
