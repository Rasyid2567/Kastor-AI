# E2E Test Infra: Kastor-AI Schedule Sync & /limit Command

## Test Philosophy
- Opaque-box, requirement-driven testing. No direct reliance on private implementation details.
- Zero data corruption: All automated tests use ephemeral `/tmp/` SQLite databases (`/tmp/kastor_test_${pid}.sqlite`).
- Structured 4-Tier verification matching project standard.

## Feature Inventory
| # | Feature | Source (Requirement) | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|----------------------|:------:|:------:|:------:|:------:|
| 1 | PUT /api/schedules/:id block sync | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 2 | Week 18 DB update & deduplication | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 3 | /limit permission & menu isolation | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 4 | /limit sticker, ai, tt, status | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 5 | Seconds input & Xm Yd display formatter | Follow-ups (14:01, 14:02, 14:03) | 5 | 5 | ✓ | ✓ |
| 6 | Per-user cooldown enforcement | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- Test Runner: `test/e2e-limits-schedules.js` (executable via `node test/e2e-limits-schedules.js`).
- Pass/Fail Semantics: Standard Node.js assertions (`assert`). Exit code 0 on full pass, non-zero with error trace on failure.
- Supplemental test runners:
  - `npm test` (`bot/test/run-tests.js` - TEST 13 & menu verification)
  - `npm run test:web` (`web/test/web-tests.js` - SKENARIO 15)

## Test Tiers Breakdown

### Tier 1: Feature Coverage
1. `T1-SCHED-01`: PUT /api/schedules/:id updates Monday and automatically updates Tuesday through Friday for block schedules.
2. `T1-SCHED-02`: Database contains exactly 5 school day entries (1 to 5) for Week 18 with no missing or duplicate days.
3. `T1-SCHED-03`: Week 18 rows all carry subject `Kejuruan RPL (Bengkel / Praktik)`.
4. `T1-SCHED-04`: Week 18 rows all carry teacher `Guru Bengkel`.
5. `T1-SCHED-05`: Week 18 rows all carry room `Lab RPL / Bengkel`.
6. `T1-LIMIT-01`: Developer can execute `/limit status` and receives full configuration output.
7. `T1-LIMIT-02`: Class Administrator / Pengurus Otoritas can execute `/limit status`.
8. `T1-LIMIT-03`: Regular student (unauthorized) executing `/limit status` is rejected.
9. `T1-LIMIT-04`: Subcommand `/limit sticker 120` updates `bot_settings` and returns confirmation.
10. `T1-LIMIT-05`: Subcommand `/limit ai 90` updates `bot_settings` and returns confirmation.
11. `T1-LIMIT-06`: Subcommand `/limit tt 45` updates `bot_settings` and returns confirmation.
12. `T1-LIMIT-07`: Subcommand `/limit status` displays status of sticker, ai, and tt.
13. `T1-COOLDOWN-01`: Rapid subsequent call to `/ai` by same user triggers cooldown block.
14. `T1-COOLDOWN-02`: Rapid subsequent call to `/tt` by same user triggers cooldown block.

### Tier 2: Boundary & Corner Cases
1. `T2-BOUND-01`: `/limit ai abc` (non-integer argument) returns informative error without crashing.
2. `T2-BOUND-02`: `/limit ai -15` (negative seconds) is rejected.
3. `T2-BOUND-03`: `/limit ai 0` disables cooldown (subsequent calls allowed immediately).
4. `T2-BOUND-04`: `/limit sticker off` and `/limit sticker on` toggle enable flag properly.
5. `T2-BOUND-05`: Duration formatter boundary 0 seconds -> `'0d'`.
6. `T2-BOUND-06`: Duration formatter boundary 45 seconds -> `'45d'`.
7. `T2-BOUND-07`: Duration formatter boundary 59 seconds -> `'59d'`.
8. `T2-BOUND-08`: Duration formatter boundary 60 seconds -> `'1m'` (no `'1m 0d'`).
9. `T2-BOUND-09`: Duration formatter boundary 61 seconds -> `'1m 1d'`.
10. `T2-BOUND-10`: Duration formatter boundary 90 seconds -> `'1m 30d'`.
11. `T2-BOUND-11`: Duration formatter boundary 120 seconds -> `'2m'`.
12. `T2-BOUND-12`: Menu leak prevention: verify `getHelpMenu()` output does not contain `/limit`.

### Tier 3: Cross-Feature Interactions
1. `T3-CROSS-01`: Updating limit via `/limit ai 90` immediately applies to router cooldown without process restart.
2. `T3-CROSS-02`: Schedule edit via `PUT /api/schedules/:id` immediately reflects in `bot/modules/schedule.js` `getScheduleFull` without duplicate subject items.
3. `T3-CROSS-03`: Schedule edit via `PUT /api/schedules/:id` immediately reflects across `getScheduleByDay` for Monday, Tuesday, Wednesday, Thursday, Friday.
4. `T3-CROSS-04`: Web dashboard deduplication function produces exactly 1 item for synchronized block week.
5. `T3-CROSS-05`: Updating sticker limit via `/limit sticker` updates `bot_settings` and is immediately seen by `media.js` `getStickerLimitConfig()`.

### Tier 4: Real-World Scenarios
1. `T4-REAL-01`: Spamming `/ai` burst: 1st call permitted, 2nd and 3rd calls blocked with formatted wait message ("Mohon tunggu 1m 30d").
2. `T4-REAL-02`: Spamming `/tt` burst: 1st call permitted, 2nd call blocked with formatted wait message.
3. `T4-REAL-03`: Per-user isolation: User A on cooldown does NOT block User B in the same group.
4. `T4-REAL-04`: Cooldown expiration: after simulated clock advance past window duration, user is permitted to query again.
5. `T4-REAL-05`: Full E2E flow: Web admin edits Week 18, verification queries confirm Monday through Friday updated, bot user requests `/jadwal full 18` and receives clean single card.

## Coverage Thresholds
- Tier 1: 14 test cases
- Tier 2: 12 test cases
- Tier 3: 5 test cases
- Tier 4: 5 test cases
- **Total: 36 test cases**
