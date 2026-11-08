/**
 * ============================================================================
 * EMPIRICAL STRESS TEST SUITE: SCHEDULE BLOCK SYNCHRONIZATION & REALIGNMENT
 * ============================================================================
 * Adversarial challenge suite testing:
 * 1. Bell schedule invariants preservation (Mon 07:50-15:30, Tue-Wed 07:00-15:30,
 *    Thu 07:00-15:00, Fri 07:00-15:15).
 * 2. Idempotency & duplicate resistance across 10 consecutive PUT requests.
 * 3. Switching block types: BENGKEL -> TEORI and TEORI -> BENGKEL.
 * 4. Missing day auto-population with correct daily bell times.
 * 5. Production database.sqlite Week 18 data & bot module responses.
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup ephemeral DB for API stress testing
const tempDbPath = `/tmp/kastor_stress_sched_${Date.now()}_${process.pid}.sqlite`;
process.env.DATABASE_PATH = tempDbPath;
process.env.DEVELOPER_NUMBER = process.env.DEVELOPER_NUMBER || '6285155054456';

const { db, initDatabase } = await import('../database/schema.js');
const { createWebServer } = await import('../web/server.js');
const { SESSION_COOKIE_NAME } = await import('../web/src/auth.js');
const { TEST_CONSTANTS, seedTestDatabase } = await import('../web/test/setup-test-db.js');
const { getScheduleFull, getScheduleByDay } = await import('../bot/modules/schedule.js');

let server;
let baseUrl;
let sessionCookie = '';

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  failures: []
};

function assert(condition, name, details = '') {
  results.total++;
  if (condition) {
    results.passed++;
    console.log(`  ✅ [PASS] ${name}`);
  } else {
    results.failed++;
    const msg = details ? `${name} — ${details}` : name;
    results.failures.push(msg);
    console.error(`  ❌ [FAIL] ${msg}`);
  }
}

async function apiRequest(method, endpoint, { body = null, cookie = sessionCookie } = {}) {
  const url = new URL(endpoint, baseUrl);
  const headers = { 'content-type': 'application/json' };
  if (cookie) headers['cookie'] = `${SESSION_COOKIE_NAME}=${cookie}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}

  const setCookie = res.headers.get('set-cookie');
  let extractedCookie = null;
  if (setCookie) {
    const match = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    if (match) extractedCookie = match[1];
  }

  return { status: res.status, data: json, raw: text, cookie: extractedCookie };
}

async function setup() {
  seedTestDatabase(db);
  server = createWebServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // Login as Sekretaris (authorized to edit schedules)
  const regRes = await apiRequest('POST', '/api/auth/register', {
    body: {
      phone_number: TEST_CONSTANTS.PHONE_SEKRETARIS,
      password: TEST_CONSTANTS.TEST_PASSWORD
    }
  });

  const loginRes = await apiRequest('POST', '/api/auth/login', {
    body: {
      phone_number: TEST_CONSTANTS.PHONE_SEKRETARIS,
      password: TEST_CONSTANTS.TEST_PASSWORD
    }
  });

  sessionCookie = loginRes.cookie;
}

async function teardown() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  try {
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    if (fs.existsSync(`${tempDbPath}-wal`)) fs.unlinkSync(`${tempDbPath}-wal`);
    if (fs.existsSync(`${tempDbPath}-shm`)) fs.unlinkSync(`${tempDbPath}-shm`);
  } catch {}
}

async function runAdversarialTests() {
  console.log('======================================================================');
  console.log('🧪 RUNNING SCHEDULE SYNC & REALIGNMENT ADVERSARIAL STRESS TESTS');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------------
  // TEST SUITE 1: Bell Schedule Invariant Preservation
  // -------------------------------------------------------------------------
  console.log('📋 SUITE 1: Bell Schedule Invariant Preservation');
  {
    // Seed a Bengkel week (Week 10) with exact bell schedules
    db.prepare('DELETE FROM schedules WHERE group_id = ? AND week_number = 10').run(TEST_CONSTANTS.CLASS_XI_RPL_C);
    const insertStmt = db.prepare(`
      INSERT INTO schedules (group_id, week_number, day_index, block_type, subject_name, teacher_name, room_name, time_start, time_end, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(TEST_CONSTANTS.CLASS_XI_RPL_C, 10, 1, 'BENGKEL', 'Initial Bengkel', 'Guru Bengkel', 'Lab RPL', '07:50', '15:30', 'Note 1');
    insertStmt.run(TEST_CONSTANTS.CLASS_XI_RPL_C, 10, 2, 'BENGKEL', 'Initial Bengkel', 'Guru Bengkel', 'Lab RPL', '07:00', '15:30', 'Note 2');
    insertStmt.run(TEST_CONSTANTS.CLASS_XI_RPL_C, 10, 3, 'BENGKEL', 'Initial Bengkel', 'Guru Bengkel', 'Lab RPL', '07:00', '15:30', 'Note 3');
    insertStmt.run(TEST_CONSTANTS.CLASS_XI_RPL_C, 10, 4, 'BENGKEL', 'Initial Bengkel', 'Guru Bengkel', 'Lab RPL', '07:00', '15:00', 'Note 4');
    insertStmt.run(TEST_CONSTANTS.CLASS_XI_RPL_C, 10, 5, 'BENGKEL', 'Initial Bengkel', 'Guru Bengkel', 'Lab RPL', '07:00', '15:15', 'Note 5');

    const mondayRow = db.prepare('SELECT * FROM schedules WHERE group_id = ? AND week_number = 10 AND day_index = 1').get(TEST_CONSTANTS.CLASS_XI_RPL_C);

    // Update via PUT /api/schedules/:id with Monday payload
    const putRes = await apiRequest('PUT', `/api/schedules/${mondayRow.id}`, {
      body: {
        week_number: 10,
        day_index: 1,
        block_type: 'BENGKEL',
        subject_name: 'Pemrograman Perangkat Bergerak',
        teacher_name: 'Pak Guru Mobile',
        room_name: 'Lab RPL / Bengkel',
        time_start: '07:50',
        time_end: '15:30',
        notes: 'Wearpack Wajib'
      }
    });

    assert(putRes.status === 200, 'INV-01: PUT /api/schedules/:id returns status 200 OK');

    const rows = db.prepare('SELECT * FROM schedules WHERE group_id = ? AND week_number = 10 ORDER BY day_index ASC').all(TEST_CONSTANTS.CLASS_XI_RPL_C);
    assert(rows.length === 5, `INV-02: Exactly 5 rows remain for Week 10 (got ${rows.length})`);

    const day1 = rows.find(r => r.day_index === 1);
    const day2 = rows.find(r => r.day_index === 2);
    const day3 = rows.find(r => r.day_index === 3);
    const day4 = rows.find(r => r.day_index === 4);
    const day5 = rows.find(r => r.day_index === 5);

    assert(day1.time_start === '07:50' && day1.time_end === '15:30', 'INV-03: Monday bell time strictly preserved (07:50 - 15:30)');
    assert(day2.time_start === '07:00' && day2.time_end === '15:30', 'INV-04: Tuesday bell time strictly preserved (07:00 - 15:30, NOT overwritten with 07:50)');
    assert(day3.time_start === '07:00' && day3.time_end === '15:30', 'INV-05: Wednesday bell time strictly preserved (07:00 - 15:30, NOT overwritten with 07:50)');
    assert(day4.time_start === '07:00' && day4.time_end === '15:00', 'INV-06: Thursday bell time strictly preserved (07:00 - 15:00, NOT overwritten with 15:30)');
    assert(day5.time_start === '07:00' && day5.time_end === '15:15', 'INV-07: Friday bell time strictly preserved (07:00 - 15:15, NOT overwritten with 15:30)');

    const allHaveSameMetadata = rows.every(r =>
      r.subject_name === 'Pemrograman Perangkat Bergerak' &&
      r.teacher_name === 'Pak Guru Mobile' &&
      r.room_name === 'Lab RPL / Bengkel' &&
      r.notes === 'Wearpack Wajib'
    );
    assert(allHaveSameMetadata, 'INV-08: Sibling days synchronized subject, teacher, room, and notes');
  }

  // -------------------------------------------------------------------------
  // TEST SUITE 2: Idempotency & Duplicate Resistance
  // -------------------------------------------------------------------------
  console.log('\n📋 SUITE 2: Idempotency & Duplicate Resistance (10 Consecutive PUTs)');
  {
    db.prepare('DELETE FROM schedules WHERE group_id = ? AND week_number = 11').run(TEST_CONSTANTS.CLASS_XI_RPL_C);
    const insertStmt = db.prepare(`
      INSERT INTO schedules (group_id, week_number, day_index, block_type, subject_name, teacher_name, room_name, time_start, time_end, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Initially insert only Monday and Wednesday (Tuesday, Thursday, Friday missing)
    insertStmt.run(TEST_CONSTANTS.CLASS_XI_RPL_C, 11, 1, 'BENGKEL', 'Basis Data Lanjut', 'Guru DB', 'Lab 2', '07:50', '15:30', 'Initial');
    insertStmt.run(TEST_CONSTANTS.CLASS_XI_RPL_C, 11, 3, 'BENGKEL', 'Basis Data Lanjut', 'Guru DB', 'Lab 2', '07:00', '15:30', 'Initial');

    const mondayRow = db.prepare('SELECT * FROM schedules WHERE group_id = ? AND week_number = 11 AND day_index = 1').get(TEST_CONSTANTS.CLASS_XI_RPL_C);

    let allTenPassed = true;
    let intermediateCounts = [];

    for (let i = 1; i <= 10; i++) {
      const putRes = await apiRequest('PUT', `/api/schedules/${mondayRow.id}`, {
        body: {
          week_number: 11,
          day_index: 1,
          block_type: 'BENGKEL',
          subject_name: 'Basis Data Lanjut',
          teacher_name: 'Guru DB',
          room_name: 'Lab 2',
          time_start: '07:50',
          time_end: '15:30',
          notes: `Update #${i}`
        }
      });

      if (putRes.status !== 200 || putRes.data?.ok !== true) {
        allTenPassed = false;
      }

      const currentCount = db.prepare('SELECT COUNT(*) as c FROM schedules WHERE group_id = ? AND week_number = 11').get(TEST_CONSTANTS.CLASS_XI_RPL_C).c;
      intermediateCounts.push(currentCount);
    }

    assert(allTenPassed, 'IDEM-01: All 10 consecutive PUT requests succeeded with 200 OK');
    const strictlyFiveEveryTime = intermediateCounts.every(c => c === 5);
    assert(strictlyFiveEveryTime, `IDEM-02: Row count strictly remained 5 after every single PUT (history: [${intermediateCounts.join(', ')}])`);

    const finalRows = db.prepare('SELECT day_index, count(*) as count FROM schedules WHERE group_id = ? AND week_number = 11 GROUP BY day_index ORDER BY day_index ASC').all(TEST_CONSTANTS.CLASS_XI_RPL_C);
    assert(finalRows.length === 5, `IDEM-03: Exactly 5 unique day_index entries exist (1 to 5)`);
    assert(finalRows.every(r => r.count === 1), 'IDEM-04: Zero duplicate day rows exist across all days');
  }

  // -------------------------------------------------------------------------
  // TEST SUITE 3: Switching Block Types (BENGKEL <-> TEORI)
  // -------------------------------------------------------------------------
  console.log('\n📋 SUITE 3: Switching Block Types (BENGKEL <-> TEORI)');
  {
    // 3A: TEORI -> BENGKEL
    db.prepare('DELETE FROM schedules WHERE group_id = ? AND week_number = 12').run(TEST_CONSTANTS.CLASS_XI_RPL_C);
    const insertStmt = db.prepare(`
      INSERT INTO schedules (group_id, week_number, day_index, block_type, subject_name, teacher_name, room_name, time_start, time_end, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Insert 5 TEORI rows rolling subject
    for (let d = 1; d <= 5; d++) {
      insertStmt.run(TEST_CONSTANTS.CLASS_XI_RPL_C, 12, d, 'TEORI', 'Matematika Terapan', 'Guru MTK', 'R.1', '07:00', '15:00', 'Teori');
    }

    const tMon = db.prepare('SELECT * FROM schedules WHERE group_id = ? AND week_number = 12 AND day_index = 1').get(TEST_CONSTANTS.CLASS_XI_RPL_C);

    const switchRes1 = await apiRequest('PUT', `/api/schedules/${tMon.id}`, {
      body: {
        week_number: 12,
        day_index: 1,
        block_type: 'BENGKEL',
        subject_name: 'Pemrograman Web (Bengkel)',
        teacher_name: 'Guru Web',
        room_name: 'Lab RPL / Bengkel',
        time_start: '07:50',
        time_end: '15:30',
        notes: 'Switch to Bengkel'
      }
    });

    assert(switchRes1.status === 200, 'SW-01: Switching TEORI -> BENGKEL returns 200 OK');
    const rowsPostBengkel = db.prepare('SELECT * FROM schedules WHERE group_id = ? AND week_number = 12 ORDER BY day_index ASC').all(TEST_CONSTANTS.CLASS_XI_RPL_C);
    assert(rowsPostBengkel.length === 5, `SW-02: Total rows after TEORI -> BENGKEL is strictly 5 (got ${rowsPostBengkel.length})`);
    assert(rowsPostBengkel.every(r => r.block_type === 'BENGKEL'), 'SW-03: All 5 rows converted to block_type = BENGKEL');

    // 3B: BENGKEL -> TEORI
    // Now switch that BENGKEL week back to TEORI
    const bMon = rowsPostBengkel.find(r => r.day_index === 1);
    const switchRes2 = await apiRequest('PUT', `/api/schedules/${bMon.id}`, {
      body: {
        week_number: 12,
        day_index: 1,
        block_type: 'TEORI',
        subject_name: 'Pemrograman Berorientasi Objek',
        teacher_name: 'Guru PBO',
        room_name: 'Ruang Teori (R.2)',
        time_start: '07:50',
        time_end: '15:30',
        notes: 'Switch to Teori'
      }
    });

    assert(switchRes2.status === 200, 'SW-04: Switching BENGKEL -> TEORI returns 200 OK');
    const rowsPostTeori = db.prepare('SELECT * FROM schedules WHERE group_id = ? AND week_number = 12 ORDER BY day_index ASC').all(TEST_CONSTANTS.CLASS_XI_RPL_C);
    
    // Check if BENGKEL -> TEORI creates duplicates or maintains clean row count
    assert(rowsPostTeori.length === 5, `SW-05: Total rows after BENGKEL -> TEORI is strictly 5 (got ${rowsPostTeori.length})`, `Expected 5 rows, but got ${rowsPostTeori.length} (check duplicate insertion on block_type transition)`);
  }

  // -------------------------------------------------------------------------
  // TEST SUITE 4: Missing Days & Duplicate Cleansing
  // -------------------------------------------------------------------------
  console.log('\n📋 SUITE 4: Missing Days Auto-Populate & Duplicate Cleansing');
  {
    db.prepare('DELETE FROM schedules WHERE group_id = ? AND week_number = 13').run(TEST_CONSTANTS.CLASS_XI_RPL_C);
    const insertStmt = db.prepare(`
      INSERT INTO schedules (group_id, week_number, day_index, block_type, subject_name, teacher_name, room_name, time_start, time_end, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Day 1 (Monday)
    const mRes = insertStmt.run(TEST_CONSTANTS.CLASS_XI_RPL_C, 13, 1, 'BENGKEL', 'Workshop IoT', 'Guru IoT', 'Lab IoT', '07:50', '15:30', 'A');
    const mId = Number(mRes.lastInsertRowid);
    // Day 2 (Tuesday) missing!
    // Day 3 (Wednesday)
    insertStmt.run(TEST_CONSTANTS.CLASS_XI_RPL_C, 13, 3, 'BENGKEL', 'Workshop IoT', 'Guru IoT', 'Lab IoT', '07:00', '15:30', 'B');
    // Day 4 (Thursday) missing!
    // Day 5 (Friday) has 3 duplicates!
    insertStmt.run(TEST_CONSTANTS.CLASS_XI_RPL_C, 13, 5, 'BENGKEL', 'Workshop IoT', 'Guru IoT', 'Lab IoT', '07:00', '15:15', 'Dup 1');
    insertStmt.run(TEST_CONSTANTS.CLASS_XI_RPL_C, 13, 5, 'BENGKEL', 'Workshop IoT', 'Guru IoT', 'Lab IoT', '15:15', '16:00', 'Dup 2');
    insertStmt.run(TEST_CONSTANTS.CLASS_XI_RPL_C, 13, 5, 'BENGKEL', 'Workshop IoT', 'Guru IoT', 'Lab IoT', '16:00', '17:00', 'Dup 3');

    const putRes = await apiRequest('PUT', `/api/schedules/${mId}`, {
      body: {
        week_number: 13,
        day_index: 1,
        block_type: 'BENGKEL',
        subject_name: 'Workshop IoT Terapan',
        teacher_name: 'Guru IoT Master',
        room_name: 'Lab IoT',
        time_start: '07:50',
        time_end: '15:30',
        notes: 'Auto populate & clean'
      }
    });

    assert(putRes.status === 200, 'CLN-01: PUT request succeeds with 200 OK');
    const rows = db.prepare('SELECT * FROM schedules WHERE group_id = ? AND week_number = 13 ORDER BY day_index ASC').all(TEST_CONSTANTS.CLASS_XI_RPL_C);
    assert(rows.length === 5, `CLN-02: Exactly 5 rows exist after cleansing (got ${rows.length})`);

    const day2 = rows.find(r => r.day_index === 2);
    const day4 = rows.find(r => r.day_index === 4);
    const day5 = rows.find(r => r.day_index === 5);

    assert(day2 && day2.time_start === '07:00' && day2.time_end === '15:30', 'CLN-03: Missing Tuesday auto-populated with standard bell 07:00-15:30');
    assert(day4 && day4.time_start === '07:00' && day4.time_end === '15:00', 'CLN-04: Missing Thursday auto-populated with standard bell 07:00-15:00');
    assert(day5 && day5.time_start === '07:00' && day5.time_end === '15:15', 'CLN-05: Friday duplicates purged, keeping single row with 07:00-15:15');
  }

  // -------------------------------------------------------------------------
  // TEST SUITE 5: Production database.sqlite Week 18 Verification
  // -------------------------------------------------------------------------
  console.log('\n📋 SUITE 5: Production database.sqlite Week 18 Verification');
  {
    const prodDbPath = path.resolve(__dirname, '../database.sqlite');
    assert(fs.existsSync(prodDbPath), `PROD-01: database.sqlite exists at ${prodDbPath}`);

    const { DatabaseSync } = await import('node:sqlite');
    const prodDb = new DatabaseSync(prodDbPath, { readOnly: true });

    const w18Rows = prodDb.prepare(`
      SELECT * FROM schedules
      WHERE week_number = 18 AND group_id = '120363401603280130@g.us'
      ORDER BY day_index ASC
    `).all();

    assert(w18Rows.length === 5, `PROD-02: Exactly 5 rows exist for Week 18 in database.sqlite (got ${w18Rows.length})`);

    const days = w18Rows.map(r => r.day_index);
    assert(JSON.stringify(days) === JSON.stringify([1, 2, 3, 4, 5]), `PROD-03: Week 18 spans strictly day_index 1..5 ([${days.join(', ')}])`);

    const allSubjectBengkel = w18Rows.every(r => r.subject_name === 'Kejuruan RPL (Bengkel / Praktik)');
    const allTeacherBengkel = w18Rows.every(r => r.teacher_name === 'Guru Bengkel');
    const allRoomBengkel = w18Rows.every(r => r.room_name === 'Lab RPL / Bengkel');
    const allTypeBengkel = w18Rows.every(r => r.block_type === 'BENGKEL');

    assert(allSubjectBengkel, 'PROD-04: All Week 18 rows carry subject "Kejuruan RPL (Bengkel / Praktik)"');
    assert(allTeacherBengkel, 'PROD-05: All Week 18 rows carry teacher "Guru Bengkel"');
    assert(allRoomBengkel, 'PROD-06: All Week 18 rows carry room "Lab RPL / Bengkel"');
    assert(allTypeBengkel, 'PROD-07: All Week 18 rows carry block_type "BENGKEL"');

    const d1 = w18Rows.find(r => r.day_index === 1);
    const d2 = w18Rows.find(r => r.day_index === 2);
    const d3 = w18Rows.find(r => r.day_index === 3);
    const d4 = w18Rows.find(r => r.day_index === 4);
    const d5 = w18Rows.find(r => r.day_index === 5);

    assert(d1.time_start === '07:50' && d1.time_end === '15:30', 'PROD-08: Week 18 Monday bell time is 07:50 - 15:30');
    assert(d2.time_start === '07:00' && d2.time_end === '15:30', 'PROD-09: Week 18 Tuesday bell time is 07:00 - 15:30');
    assert(d3.time_start === '07:00' && d3.time_end === '15:30', 'PROD-10: Week 18 Wednesday bell time is 07:00 - 15:30');
    assert(d4.time_start === '07:00' && d4.time_end === '15:00', 'PROD-11: Week 18 Thursday bell time is 07:00 - 15:00');
    assert(d5.time_start === '07:00' && d5.time_end === '15:15', 'PROD-12: Week 18 Friday bell time is 07:00 - 15:15');

    // Test bot module output against live database
    // Test bot module output against live database
    const { execFileSync } = await import('node:child_process');
    const fullWeek18Raw = execFileSync(process.execPath, [
      '--input-type=module',
      '-e',
      `import { getScheduleFull } from './bot/modules/schedule.js';
       process.stdout.write(JSON.stringify(getScheduleFull('120363401603280130@g.us', 18)));`
    ], {
      env: { ...process.env, DATABASE_PATH: prodDbPath },
      encoding: 'utf-8'
    });
    const fullWeek18 = JSON.parse(fullWeek18Raw);

    assert(
      fullWeek18.includes('Minggu Ke-18') && fullWeek18.includes('Kejuruan RPL (Bengkel / Praktik)'),
      'PROD-13: bot getScheduleFull(groupId, 18) outputs Week 18 card with Kejuruan RPL'
    );
    // Ensure getScheduleFull deduplicates and only outputs 1 card/item for the block
    const cardItems = fullWeek18.match(/\d+\.\s+Mapel:/g) || [];
    assert(cardItems.length === 1, `PROD-14: bot getScheduleFull outputs exactly 1 unique item for block week (got ${cardItems.length})`);
  }

  console.log('\n======================================================================');
  console.log(`📊 STRESS TEST RESULTS: ${results.passed} PASSED, ${results.failed} FAILED (TOTAL: ${results.total})`);
  console.log('======================================================================');

  if (results.failed > 0) {
    console.error('\n❌ FAILURES DETECTED:');
    for (const f of results.failures) {
      console.error(`  - ${f}`);
    }
  }

  return results.failed === 0;
}

try {
  await setup();
  const success = await runAdversarialTests();
  await teardown();
  process.exit(success ? 0 : 1);
} catch (err) {
  console.error('Fatal stress test runner error:', err);
  await teardown();
  process.exit(1);
}
