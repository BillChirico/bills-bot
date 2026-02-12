# Feature Backlog

Priority grades: **P0** (critical), **P1** (high), **P2** (medium), **P3** (nice-to-have).

## P1 — High Priority

| Feature | Description | Notes |
|---------|-------------|-------|
| Case notes | `/case note` — add notes/comments to existing cases | Natural extension of case system |
| Appeal system | Users can appeal bans/timeouts via DM to bot | Needs workflow design |

## P2 — Medium Priority

| Feature | Description | Notes |
|---------|-------------|-------|
| Server-wide lockdown | Lock all text channels at once | `/lock` covers single-channel for now |
| Auto-mod rules engine | Configurable regex/keyword filters beyond spam patterns | Separate project scope |
| Purge by role | `/purge role @role count` | Niche purge variant |
| Purge by date range | `/purge before <date> count` | Niche purge variant |
| Case export | Export case history as CSV/JSON | Useful for large servers |
| Mod log message editing | Edit mod log embed when case reason is updated | Tracked in `log_message_id` |

## P3 — Nice to Have

| Feature | Description | Notes |
|---------|-------------|-------|
| Voice moderation | Mute/deafen/disconnect voice users | Niche use case |
| Purge by emoji | Delete messages containing specific emoji | Diminishing returns |
| Escalation cooldowns | Prevent escalation from firing repeatedly | Edge case |
| Non-warn escalation | Escalation triggers from timeouts, not just warns | Complex |
| Mod stats dashboard | `/modstats` — moderator activity leaderboard | Fun but low priority |
| Scheduled messages | Schedule announcements to channels | Separate feature scope |
