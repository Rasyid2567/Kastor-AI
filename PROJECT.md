# Project: Kastor-AI Schedule Sync, Secret /limit Command & Deployment

## Architecture
- **Web Dashboard Backend (`web/src/routes.js`)**: Node/Deno HTTP server serving `/api/schedules/:id` and other REST endpoints backed by SQLite (`node:sqlite` / Deno SQLite).
- **Web Dashboard Frontend (`web/public/app.js`)**: Vanilla JS SPA with responsive schedule table, deduplicating rolling block schedules for week views and triggering schedule modal edits.
- **WhatsApp Bot Router (`bot/router.js`)**: Baileys-based message dispatcher routing incoming private messages and group commands, enforcing permissions, rate limiting, and menu isolation (`getHelpMenu()`).
- **Bot Modules**:
  - `bot/modules/schedule.js`: Queries and formats daily/weekly schedules (`getScheduleFull`, `getScheduleByDay`).
  - `bot/modules/secret.js`: Handles secret commands (`/rvo`, `/ortu`, and the new `/limit` command), `isAuthorizedLimitUser()`, `formatLimitDuration()`, and `checkUserCooldown()`.
  - `bot/modules/media.js`: Sticker creation and sticker rate limiting configuration (`bot_settings`).
  - `bot/modules/downloader.js`: Video downloading (`/tt`, `/yt`, `/ig`, `/fb`).
  - `bot/modules/ai.js`: AI assistant query dispatch.
- **Database (`database/schema.js` & `database.sqlite`)**: SQLite database with WAL mode storing `schedules`, `bot_settings`, `classes`, `class_roles`, `web_users`, and `sticker_rate_limits`.
- **Server Deployment (`talun`)**: Tailscale IP `100.78.4.35` / `192.168.1.20` hosting systemd services `kastor-ai` and `kastor-web` managed under Deno runtime.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | DB Pull from Server | Pull latest database from talun with WAL checkpoint before code modifications | M1 | ORIGINAL_REQUEST §R3 |
| 2 | PUT /api/schedules/:id Block Sync | Synchronize Monday-Friday (day_index 1..5) on PUT block edit, preserving bell times and preventing duplicates | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Week 18 Schedule DB Update | Update Week 18 records to "Kejuruan RPL (Bengkel / Praktik)", "Guru Bengkel", "Lab RPL / Bengkel" | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Secret /limit Menu Isolation | Ensure /limit command is never displayed in /menu (excluded from getHelpMenu()) | M2 | ORIGINAL_REQUEST §R2 |
| 5 | /limit Permission Authorization | Restrict /limit to Developer and Pengurus Otoritas, reject unauthorized callers | M2 | ORIGINAL_REQUEST §R2 |
| 6 | /limit Subcommands & bot_settings Persistence | Implement /limit sticker, /limit ai, /limit tt, /limit status with persistent storage in bot_settings | M2 | ORIGINAL_REQUEST §R2 |
| 7 | Seconds Input & Duration Display Formatter | Accept input in SECONDS; display formatted duration ("1m 30d", "2m", "45d", "0d") in status and cooldown messages | M2 | Follow-ups (14:01, 14:02, 14:03) |
| 8 | Per-User Cooldown Enforcement | In-memory per-user cooldown tracking for AI, downloader, and sticker commands based on bot_settings | M2 | ORIGINAL_REQUEST §R2 |
| 9 | 4-Tier E2E Test Suite | Build dedicated E2E test suite in test/e2e-limits-schedules.js and augment existing test runners | E2E-Track | ORIGINAL_REQUEST Acceptance Criteria |
| 10 | Final E2E Test Pass & Adversarial Hardening | Pass 100% of E2E tests (Tiers 1-4) and adversarial stress test hardening (Tier 5) | M3 | Project Pattern Final Milestone |
| 11 | Code Sync to Server & Service Restart | Rsync verified code to talun (excluding DB & baileys auth) and restart systemd services | M4 | ORIGINAL_REQUEST §R3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Suite | Build 4-tier opaque-box E2E test runner (test/e2e-limits-schedules.js) & publish TEST_READY.md | none | IN_PROGRESS |
| M1 | Schedule Sync & Week 18 DB Update | Pull DB from talun, fix PUT /api/schedules/:id block sync in web/src/routes.js, update Week 18 in database.sqlite | none | IN_PROGRESS |
| M2 | Secret /limit & Rate Limiting | Implement /limit command, bot_settings persistence, formatLimitDuration, isAuthorizedLimitUser, and router cooldowns | none | IN_PROGRESS |
| M3 | Final E2E Pass & Hardening | Verify 100% pass on Tiers 1-4 E2E tests, execute Tier 5 adversarial testing | E2E, M1, M2 | PLANNED |
| M4 | Server Deployment & Restart | Rsync codebase to talun, restart kastor-ai & kastor-web, verify service health | M3 | PLANNED |

## Interface Contracts
### `web/src/routes.js` ↔ SQLite `schedules`
- `PUT /api/schedules/:id`:
  - Request Body: `{ week_number, day_index, block_type, subject_name, teacher_name, room_name, time_start, time_end, notes }`
  - Effect: Updates record `:id` and atomically synchronizes days 1..5 for that `group_id` and `week_number` if `block_type === 'BENGKEL'`. Preserves standard bell start/end times per day.
  - Response: `{ success: true, message: 'Jadwal berhasil diperbarui', count_synchronized: 5 }`

### `bot/modules/secret.js` ↔ `bot/router.js`
- `formatLimitDuration(seconds: number): string`:
  - `0` -> `'0d'`
  - `45` -> `'45d'`
  - `60` -> `'1m'`
  - `90` -> `'1m 30d'`
  - `120` -> `'2m'`
- `isAuthorizedLimitUser(senderJid: string, groupId: string|null, devConfig: string): boolean`:
  - Returns `true` if `senderJid` is developer, in `class_roles` (KETUA, SEKRETARIS, BENDAHARA), or in `web_users`.
- `checkUserCooldown(type: 'sticker'|'ai'|'tt', userId: string): { allowed: boolean, remaining_seconds?: number, formatted_remaining?: string }`
- `recordUserCooldown(type: 'sticker'|'ai'|'tt', userId: string): void`
- `clearUserCooldown(type: 'sticker'|'ai'|'tt', userId: string): void`
- `getBotLimitConfig(): { sticker: { enabled, window_seconds }, ai: { enabled, window_seconds }, tt: { enabled, window_seconds } }`
- `updateBotLimitConfig(type: string, { enabled?: boolean, window_seconds?: number }): object`
- `handleLimitCommand(sock, msg, remoteJid, senderJid, args, devNumber): Promise<void>`

## Code Layout
- `bot/router.js`: Routing for `/limit`, menu exclusion in `getHelpMenu()`, cooldown checks in `/ai`, `@mention`, `/tt`, `/yt`, `/ig`, `/fb`, `/s`.
- `bot/modules/secret.js`: `handleLimitCommand`, `formatLimitDuration`, `isAuthorizedLimitUser`, cooldown tracker and `bot_settings` limit helpers.
- `database/schema.js`: Seed defaults for `ai_limit_*` and `tt_limit_*` in `initDatabase()`.
- `web/src/routes.js`: Synchronized block update in `PUT /api/schedules/:id`.
- `test/e2e-limits-schedules.js`: Dedicated 4-tier E2E test runner.
- `bot/test/run-tests.js`: TEST 13 unit tests for limit commands, permissions, and menu isolation.
- `web/test/web-tests.js`: SKENARIO 15 unit tests for block schedule PUT synchronization.
