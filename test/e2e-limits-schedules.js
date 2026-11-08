/**
 * ============================================================================
 * KASTOR AI — 4-TIER E2E TEST RUNNER: LIMITS & SCHEDULES
 * ============================================================================
 * Comprehensive, standalone End-to-End verification test runner verifying:
 * - Tier 1: Feature Coverage (T1-SCHED-01 to T1-COOLDOWN-02) - 14 tests
 * - Tier 2: Boundary & Corner Cases (T2-BOUND-01 to T2-BOUND-12) - 12 tests
 * - Tier 3: Cross-Feature Interactions (T3-CROSS-01 to T3-CROSS-05) - 5 tests
 * - Tier 4: Real-World Scenarios (T4-REAL-01 to T4-REAL-05) - 5 tests
 *
 * Requirements & Constraints:
 * - Ephemeral SQLite DB in /tmp/ (Zero data corruption)
 * - Standalone executable via `node test/e2e-limits-schedules.js`
 * - createWebServer() on port 0 for API tests
 * - Baileys mock socket and message objects for bot/router.js
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Database isolation: Ephemeral database in /tmp/
const tempDbPath = `/tmp/kastor_e2e_${Date.now()}_${process.pid}.sqlite`;
process.env.DATABASE_PATH = tempDbPath;
process.env.DEVELOPER_NUMBER = process.env.DEVELOPER_NUMBER || '6285155054456';

// 2. Dynamic imports after environment variable setup
const { db, initDatabase } = await import('../database/schema.js');
const { createWebServer } = await import('../web/server.js');
const { SESSION_COOKIE_NAME } = await import('../web/src/auth.js');
const { TEST_CONSTANTS, seedTestDatabase } = await import('../web/test/setup-test-db.js');
const { routeMessage, getHelpMenu } = await import('../bot/router.js');
const {
  formatLimitDuration,
  isAuthorizedLimitUser,
  getBotLimitConfig,
  updateBotLimitConfig,
  checkUserCooldown,
  recordUserCooldown,
  clearUserCooldown,
  resetAllUserCooldowns,
  handleLimitCommand
} = await import('../bot/modules/secret.js');
const { getScheduleFull, getScheduleByDay } = await import('../bot/modules/schedule.js');
const { getStickerLimitConfig, checkStickerRateLimit } = await import('../bot/modules/media.js');

// Parse CLI flags: --tier=1, --tier=2, --tier=3, --tier=4, --verbose
const args = process.argv.slice(2);
const tierArg = args.find(a => a.startsWith('--tier='));
const targetTier = tierArg ? parseInt(tierArg.split('=')[1], 10) : null;
const isVerbose = args.includes('--verbose') || args.includes('-v');

// Test statistics
const stats = {
  totalPassed: 0,
  totalFailed: 0,
  byTier: {
    1: { name: 'Tier 1: Feature Coverage', passed: 0, failed: 0, target: 14 },
    2: { name: 'Tier 2: Boundary & Corner Cases', passed: 0, failed: 0, target: 12 },
    3: { name: 'Tier 3: Cross-Feature Interactions', passed: 0, failed: 0, target: 5 },
    4: { name: 'Tier 4: Real-World Scenarios', passed: 0, failed: 0, target: 5 }
  },
  failures: []
};

function recordTest(tier, id, name, condition, details = '') {
  if (condition) {
    stats.totalPassed++;
    stats.byTier[tier].passed++;
    console.log(`  ✅ [PASS] [${id}] ${name}`);
  } else {
    stats.totalFailed++;
    stats.byTier[tier].failed++;
    const errMsg = details ? `[${id}] ${name} — ${details}` : `[${id}] ${name}`;
    stats.failures.push(errMsg);
    console.error(`  ❌ [FAIL] ${errMsg}`);
  }
}

/**
 * HTTP Client helper using native fetch
 */
function createApiClient(baseUrl) {
  let cookieJar = '';
  return {
    getCookieJar: () => cookieJar,
    setCookieJar: (c) => { cookieJar = c; },
    clearCookies: () => { cookieJar = ''; },
    async request(method, urlPath, { body = null, headers = {}, ip = '127.0.0.1' } = {}) {
      const reqHeaders = {
        'X-Forwarded-For': ip,
        ...headers
      };
      if (cookieJar) {
        reqHeaders['Cookie'] = cookieJar;
      }
      const opts = { method, headers: reqHeaders };
      if (body !== null && body !== undefined) {
        reqHeaders['Content-Type'] = 'application/json';
        opts.body = typeof body === 'string' ? body : JSON.stringify(body);
      }
      const res = await fetch(`${baseUrl}${urlPath}`, opts);
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) {
        const match = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]*)`));
        if (match) {
          if (match[1] === '' || setCookie.includes('Max-Age=0')) {
            cookieJar = '';
          } else {
            cookieJar = `${SESSION_COOKIE_NAME}=${match[1]}`;
          }
        }
      }
      const contentType = res.headers.get('content-type') || '';
      let data = null;
      const text = await res.text();
      if (contentType.includes('application/json')) {
        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }
      }
      return { status: res.status, headers: res.headers, setCookie: setCookie || '', data, text };
    }
  };
}

/**
 * WhatsApp Baileys Mock Helper with robust message container
 */
const mockBus = {
  sent: [],
  clear() {
    this.sent.length = 0;
  }
};

function createMockSocket(bus) {
  return {
    user: { id: `${TEST_CONSTANTS.PHONE_DEVELOPER}:1@s.whatsapp.net` },
    sendMessage: async (jid, content, options) => {
      bus.sent.push({ jid, content, options });
      return { key: { id: `mock_id_${Math.random().toString(36).slice(2, 8)}` } };
    },
    sendPresenceUpdate: async () => {},
    profilePictureUrl: async () => null,
    groupMetadata: async (gid) => ({
      id: gid,
      subject: 'XI RPL C',
      participants: [
        { id: `${TEST_CONSTANTS.PHONE_DEVELOPER}@s.whatsapp.net`, admin: 'superadmin' },
        { id: `${TEST_CONSTANTS.PHONE_KETUA}@s.whatsapp.net`, admin: 'admin' },
        { id: `${TEST_CONSTANTS.PHONE_SEKRETARIS}@s.whatsapp.net`, admin: 'admin' },
        { id: `${TEST_CONSTANTS.PHONE_REGULAR_STUDENT}@s.whatsapp.net`, admin: null }
      ]
    })
  };
}

function createMockMsg({ sender, text, groupId = TEST_CONSTANTS.CLASS_XI_RPL_C, isGroup = true }) {
  const remoteJid = isGroup ? groupId : sender;
  return {
    key: {
      remoteJid,
      participant: isGroup ? sender : undefined,
      fromMe: false,
      id: `mock_msg_${Math.random().toString(36).slice(2, 8)}`
    },
    message: { conversation: text },
    messageTimestamp: Math.floor(Date.now() / 1000)
  };
}

// ============================================================================
// MAIN RUNNER EXECUTION
// ============================================================================
console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║        KASTOR AI — 4-TIER E2E TEST SUITE: LIMITS & SCHEDULES         ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');
console.log(`📂 Ephemeral Test Database: ${tempDbPath}`);
console.log(`⏱️  Timestamp: ${new Date().toISOString()}`);

// Initialize DB schema & seed
initDatabase();
seedTestDatabase(db);

// Launch Ephemeral Web Server on port 0
const server = createWebServer();
let baseUrl = '';

try {
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`🚀 Web Server active at: ${baseUrl}\n`);

  // Setup Web Clients (Sekretaris, Ketua, Developer)
  const sekretarisClient = createApiClient(baseUrl);
  const ketuaClient = createApiClient(baseUrl);
  const devClient = createApiClient(baseUrl);

  // Register and Login Sekretaris (Authorized for Schedules)
  await sekretarisClient.request('POST', '/api/auth/register', {
    ip: '10.10.1.1',
    body: { phone_number: TEST_CONSTANTS.PHONE_SEKRETARIS, password: TEST_CONSTANTS.TEST_PASSWORD }
  });
  await sekretarisClient.request('POST', '/api/auth/login', {
    ip: '10.10.1.1',
    body: { phone_number: TEST_CONSTANTS.PHONE_SEKRETARIS, password: TEST_CONSTANTS.TEST_PASSWORD }
  });

  // Register and Login Ketua
  await ketuaClient.request('POST', '/api/auth/register', {
    ip: '10.10.1.2',
    body: { phone_number: TEST_CONSTANTS.PHONE_KETUA, password: TEST_CONSTANTS.TEST_PASSWORD }
  });
  await ketuaClient.request('POST', '/api/auth/login', {
    ip: '10.10.1.2',
    body: { phone_number: TEST_CONSTANTS.PHONE_KETUA, password: TEST_CONSTANTS.TEST_PASSWORD }
  });

  // Register and Login Developer
  await devClient.request('POST', '/api/auth/register', {
    ip: '10.10.1.3',
    body: { phone_number: TEST_CONSTANTS.PHONE_DEVELOPER, password: TEST_CONSTANTS.TEST_PASSWORD }
  });
  await devClient.request('POST', '/api/auth/login', {
    ip: '10.10.1.3',
    body: { phone_number: TEST_CONSTANTS.PHONE_DEVELOPER, password: TEST_CONSTANTS.TEST_PASSWORD }
  });

  // Pre-seed Week 18 block schedule in test DB (representing initial state before sync)
  db.prepare('DELETE FROM schedules WHERE group_id = ? AND week_number = 18').run(TEST_CONSTANTS.CLASS_XI_RPL_C);
  const insertSched = db.prepare(`
    INSERT INTO schedules (group_id, week_number, day_index, block_type, subject_name, teacher_name, room_name, time_start, time_end, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  // Monday initial
  insertSched.run(TEST_CONSTANTS.CLASS_XI_RPL_C, 18, 1, 'BENGKEL', 'Mata Pelajaran Pilihan (Bengkel)', 'Guru Pengampu MP', 'Lab RPL / Bengkel', '07:50', '15:30', 'Awal Minggu');
  // Days 3, 4, 5 (Day 2 initially missing, day 5 duplicate to simulate real dirty state)
  insertSched.run(TEST_CONSTANTS.CLASS_XI_RPL_C, 18, 3, 'BENGKEL', 'Mata Pelajaran Pilihan (Bengkel)', 'Guru Pengampu MP', 'Lab RPL / Bengkel', '07:00', '15:30', null);
  insertSched.run(TEST_CONSTANTS.CLASS_XI_RPL_C, 18, 4, 'BENGKEL', 'Mata Pelajaran Pilihan (Bengkel)', 'Guru Pengampu MP', 'Lab RPL / Bengkel', '07:00', '15:00', null);
  insertSched.run(TEST_CONSTANTS.CLASS_XI_RPL_C, 18, 5, 'BENGKEL', 'Mata Pelajaran Pilihan (Bengkel)', 'Guru Pengampu MP', 'Lab RPL / Bengkel', '07:00', '15:15', null);
  insertSched.run(TEST_CONSTANTS.CLASS_XI_RPL_C, 18, 5, 'BENGKEL', 'Bengkel / MP', 'Guru Pendamping / Wali Kelas', 'Lab RPL / Bengkel', '15:15', '16:00', null);

  const mondayRow = db.prepare('SELECT id FROM schedules WHERE group_id = ? AND week_number = 18 AND day_index = 1').get(TEST_CONSTANTS.CLASS_XI_RPL_C);
  const mondayId = mondayRow.id;

  const mockSock = createMockSocket(mockBus);

  // =========================================================================
  // TIER 1: FEATURE COVERAGE
  // =========================================================================
  if (!targetTier || targetTier === 1) {
    console.log('──────────────────────────────────────────────────────────────────────');
    console.log('📋 TIER 1: FEATURE COVERAGE (T1-SCHED-01 to T1-COOLDOWN-02)');
    console.log('──────────────────────────────────────────────────────────────────────');

    // T1-SCHED-01: PUT /api/schedules/:id updates Monday and syncs Tuesday-Friday
    {
      const res = await sekretarisClient.request('PUT', `/api/schedules/${mondayId}`, {
        body: {
          week_number: 18,
          day_index: 1,
          block_type: 'BENGKEL',
          subject_name: 'Kejuruan RPL (Bengkel / Praktik)',
          teacher_name: 'Guru Bengkel',
          room_name: 'Lab RPL / Bengkel',
          time_start: '07:50',
          time_end: '15:30',
          notes: 'Sinkronisasi Blok Bengkel'
        }
      });
      const rows = db.prepare('SELECT * FROM schedules WHERE group_id = ? AND week_number = 18 ORDER BY day_index ASC').all(TEST_CONSTANTS.CLASS_XI_RPL_C);
      const days = rows.map(r => r.day_index);
      const isSynced = [1, 2, 3, 4, 5].every(d => days.includes(d)) &&
        rows.every(r => r.subject_name === 'Kejuruan RPL (Bengkel / Praktik)');
      recordTest(
        1,
        'T1-SCHED-01',
        'PUT /api/schedules/:id updates Monday and automatically updates Tuesday through Friday',
        res.status === 200 && isSynced && (res.data?.count_synchronized >= 5 || res.data?.ok === true)
      );
    }

    // T1-SCHED-02: Database contains exactly 5 school day entries (1 to 5) with zero duplicate days
    {
      const w18Rows = db.prepare(`
        SELECT day_index, COUNT(*) as cnt FROM schedules
        WHERE group_id = ? AND week_number = 18
        GROUP BY day_index ORDER BY day_index ASC
      `).all(TEST_CONSTANTS.CLASS_XI_RPL_C);
      const totalCount = db.prepare('SELECT COUNT(*) as total FROM schedules WHERE group_id = ? AND week_number = 18').get(TEST_CONSTANTS.CLASS_XI_RPL_C).total;
      const exactly5Days = totalCount === 5 && w18Rows.length === 5 && w18Rows.every(r => r.cnt === 1);
      recordTest(
        1,
        'T1-SCHED-02',
        'Database contains exactly 5 school day entries (1 to 5) for Week 18 with no missing or duplicate days',
        exactly5Days
      );
    }

    // T1-SCHED-03: Week 18 rows all carry subject 'Kejuruan RPL (Bengkel / Praktik)'
    {
      const subjects = db.prepare('SELECT DISTINCT subject_name FROM schedules WHERE group_id = ? AND week_number = 18').all(TEST_CONSTANTS.CLASS_XI_RPL_C);
      recordTest(
        1,
        'T1-SCHED-03',
        'Week 18 rows all carry subject "Kejuruan RPL (Bengkel / Praktik)"',
        subjects.length === 1 && subjects[0].subject_name === 'Kejuruan RPL (Bengkel / Praktik)'
      );
    }

    // T1-SCHED-04: Week 18 rows all carry teacher 'Guru Bengkel'
    {
      const teachers = db.prepare('SELECT DISTINCT teacher_name FROM schedules WHERE group_id = ? AND week_number = 18').all(TEST_CONSTANTS.CLASS_XI_RPL_C);
      recordTest(
        1,
        'T1-SCHED-04',
        'Week 18 rows all carry teacher "Guru Bengkel"',
        teachers.length === 1 && teachers[0].teacher_name === 'Guru Bengkel'
      );
    }

    // T1-SCHED-05: Week 18 rows all carry room 'Lab RPL / Bengkel'
    {
      const rooms = db.prepare('SELECT DISTINCT room_name FROM schedules WHERE group_id = ? AND week_number = 18').all(TEST_CONSTANTS.CLASS_XI_RPL_C);
      recordTest(
        1,
        'T1-SCHED-05',
        'Week 18 rows all carry room "Lab RPL / Bengkel"',
        rooms.length === 1 && rooms[0].room_name === 'Lab RPL / Bengkel'
      );
    }

    // T1-LIMIT-01: Developer can execute /limit status and receives full configuration output
    {
      mockBus.clear();
      const devMsg = createMockMsg({ sender: `${TEST_CONSTANTS.PHONE_DEVELOPER}@s.whatsapp.net`, text: '/limit status' });
      await routeMessage(mockSock, devMsg);
      const reply = mockBus.sent.find(m => m.content?.text && m.content.text.includes('RATE LIMIT'));
      recordTest(
        1,
        'T1-LIMIT-01',
        'Developer can execute /limit status and receives full configuration output',
        Boolean(reply && reply.content.text.includes('Stiker') && reply.content.text.includes('AI'))
      );
    }

    // T1-LIMIT-02: Class Administrator / Pengurus Otoritas can execute /limit status
    {
      mockBus.clear();
      const ketuaMsg = createMockMsg({ sender: `${TEST_CONSTANTS.PHONE_KETUA}@s.whatsapp.net`, text: '/limit status' });
      await routeMessage(mockSock, ketuaMsg);
      const reply = mockBus.sent.find(m => m.content?.text && m.content.text.includes('RATE LIMIT'));
      recordTest(
        1,
        'T1-LIMIT-02',
        'Class Administrator / Pengurus Otoritas can execute /limit status',
        Boolean(reply)
      );
    }

    // T1-LIMIT-03: Regular student can view /limit status (clean without footer guide), but setting limits is rejected
    {
      mockBus.clear();
      // Part A: Check status as regular student -> Allowed, clean status without footer instructions
      const regularStatusMsg = createMockMsg({ sender: `${TEST_CONSTANTS.PHONE_REGULAR_STUDENT}@s.whatsapp.net`, text: '/limit status' });
      await routeMessage(mockSock, regularStatusMsg);
      const statusReply = mockBus.sent.find(m => m.content?.text && m.content.text.includes('RATE LIMIT'));
      const statusText = statusReply?.content?.text || '';
      const hasStatus = Boolean(statusReply) && statusText.includes('Stiker') && statusText.includes('AI');
      const noFooterGuide = !statusText.includes('Panduan Pengaturan') && !statusText.includes('Ubah batas');

      // Part B: Try to configure limit as regular student -> Rejected strictly to developer
      mockBus.clear();
      const regularSetMsg = createMockMsg({ sender: `${TEST_CONSTANTS.PHONE_REGULAR_STUDENT}@s.whatsapp.net`, text: '/limit ai 90' });
      await routeMessage(mockSock, regularSetMsg);
      const rej = mockBus.sent.find(m => m.content?.text && m.content.text.includes('Akses ditolak: Hanya Developer yang berhak mengatur batas limit.'));

      recordTest(
        1,
        'T1-LIMIT-03',
        'Regular student can view /limit status (clean without footer guide), but setting limits is rejected',
        hasStatus && noFooterGuide && Boolean(rej)
      );
    }

    // T1-LIMIT-04: Subcommand /limit sticker 120 updates bot_settings and returns confirmation
    {
      mockBus.clear();
      const cmd = createMockMsg({ sender: `${TEST_CONSTANTS.PHONE_DEVELOPER}@s.whatsapp.net`, text: '/limit sticker 120' });
      await routeMessage(mockSock, cmd);
      const val = db.prepare("SELECT value FROM bot_settings WHERE key = 'sticker_limit_window_seconds'").get()?.value;
      const conf = mockBus.sent.find(m => m.content?.text && (m.content.text.includes('120') || m.content.text.includes('2m')));
      recordTest(
        1,
        'T1-LIMIT-04',
        'Subcommand /limit sticker 120 updates bot_settings and returns confirmation',
        val === '120' && Boolean(conf)
      );
    }

    // T1-LIMIT-05: Subcommand /limit ai 90 updates bot_settings and returns confirmation
    {
      mockBus.clear();
      const cmd = createMockMsg({ sender: `${TEST_CONSTANTS.PHONE_DEVELOPER}@s.whatsapp.net`, text: '/limit ai 90' });
      await routeMessage(mockSock, cmd);
      const val = db.prepare("SELECT value FROM bot_settings WHERE key = 'ai_limit_window_seconds'").get()?.value;
      const conf = mockBus.sent.find(m => m.content?.text && (m.content.text.includes('1m 30d') || m.content.text.includes('90')));
      recordTest(
        1,
        'T1-LIMIT-05',
        'Subcommand /limit ai 90 updates bot_settings and returns confirmation',
        val === '90' && Boolean(conf)
      );
    }

    // T1-LIMIT-06: Subcommand /limit tt 45 updates bot_settings and returns confirmation
    {
      mockBus.clear();
      const cmd = createMockMsg({ sender: `${TEST_CONSTANTS.PHONE_DEVELOPER}@s.whatsapp.net`, text: '/limit tt 45' });
      await routeMessage(mockSock, cmd);
      const val = db.prepare("SELECT value FROM bot_settings WHERE key = 'tt_limit_window_seconds'").get()?.value;
      const conf = mockBus.sent.find(m => m.content?.text && m.content.text.includes('45d'));
      recordTest(
        1,
        'T1-LIMIT-06',
        'Subcommand /limit tt 45 updates bot_settings and returns confirmation',
        val === '45' && Boolean(conf)
      );
    }

    // T1-LIMIT-07: Subcommand /limit status displays status of sticker, ai, and tt
    {
      mockBus.clear();
      const cmd = createMockMsg({ sender: `${TEST_CONSTANTS.PHONE_DEVELOPER}@s.whatsapp.net`, text: '/limit status' });
      await routeMessage(mockSock, cmd);
      const text = mockBus.sent.find(m => m.content?.text)?.content?.text || '';
      const hasAllThree = text.includes('Stiker') && text.includes('AI') && (text.includes('Downloader') || text.includes('tt'));
      recordTest(
        1,
        'T1-LIMIT-07',
        'Subcommand /limit status displays status of sticker, ai, and tt',
        hasAllThree
      );
    }

    // T1-COOLDOWN-01: Rapid subsequent call to /ai by same user triggers cooldown block
    {
      resetAllUserCooldowns();
      updateBotLimitConfig('ai', { enabled: true, window_seconds: 90 });
      const testUser = '6281200000010@s.whatsapp.net';
      recordUserCooldown('ai', testUser);
      mockBus.clear();
      const aiMsg = createMockMsg({ sender: testUser, text: '/ai Bagaimana cara kerja relational database?' });
      await routeMessage(mockSock, aiMsg);
      const cdNotice = mockBus.sent.find(m => m.content?.text && (m.content.text.includes('cooldown') || m.content.text.includes('tunggu')));
      recordTest(
        1,
        'T1-COOLDOWN-01',
        'Rapid subsequent call to /ai by same user triggers cooldown block',
        Boolean(cdNotice)
      );
    }

    // T1-COOLDOWN-02: Rapid subsequent call to /tt by same user triggers cooldown block
    {
      resetAllUserCooldowns();
      updateBotLimitConfig('tt', { enabled: true, window_seconds: 60 });
      const testUser = '6281200000011@s.whatsapp.net';
      recordUserCooldown('tt', testUser);
      mockBus.clear();
      const ttMsg = createMockMsg({ sender: testUser, text: '/tt https://vt.tiktok.com/ZSjXq89Ab/' });
      await routeMessage(mockSock, ttMsg);
      const cdNotice = mockBus.sent.find(m => m.content?.text && (m.content.text.includes('cooldown') || m.content.text.includes('tunggu')));
      recordTest(
        1,
        'T1-COOLDOWN-02',
        'Rapid subsequent call to /tt by same user triggers cooldown block',
        Boolean(cdNotice)
      );
    }
  }

  // =========================================================================
  // TIER 2: BOUNDARY & CORNER CASES
  // =========================================================================
  if (!targetTier || targetTier === 2) {
    console.log('──────────────────────────────────────────────────────────────────────');
    console.log('📋 TIER 2: BOUNDARY & CORNER CASES (T2-BOUND-01 to T2-BOUND-12)');
    console.log('──────────────────────────────────────────────────────────────────────');

    // T2-BOUND-01: /limit ai abc (non-integer argument) returns informative error
    {
      mockBus.clear();
      const cmd = createMockMsg({ sender: `${TEST_CONSTANTS.PHONE_DEVELOPER}@s.whatsapp.net`, text: '/limit ai abc' });
      await routeMessage(mockSock, cmd);
      const errReply = mockBus.sent.find(m => m.content?.text && (m.content.text.includes('angka') || m.content.text.includes('detik')));
      recordTest(
        2,
        'T2-BOUND-01',
        '/limit ai abc (non-integer argument) returns informative error without crashing',
        Boolean(errReply)
      );
    }

    // T2-BOUND-02: /limit ai -15 (negative seconds) is rejected
    {
      mockBus.clear();
      const cmd = createMockMsg({ sender: `${TEST_CONSTANTS.PHONE_DEVELOPER}@s.whatsapp.net`, text: '/limit ai -15' });
      await routeMessage(mockSock, cmd);
      const negReply = mockBus.sent.find(m => m.content?.text && (m.content.text.includes('angka') || m.content.text.includes('detik') || m.content.text.includes('tidak valid')));
      recordTest(
        2,
        'T2-BOUND-02',
        '/limit ai -15 (negative seconds) is rejected',
        Boolean(negReply)
      );
    }

    // T2-BOUND-03: /limit ai 0 disables cooldown (subsequent calls allowed immediately)
    {
      mockBus.clear();
      const cmd = createMockMsg({ sender: `${TEST_CONSTANTS.PHONE_DEVELOPER}@s.whatsapp.net`, text: '/limit ai 0' });
      await routeMessage(mockSock, cmd);
      const enabled = db.prepare("SELECT value FROM bot_settings WHERE key = 'ai_limit_enabled'").get()?.value;
      const cdZero = checkUserCooldown('ai', 'any_user_id');
      recordTest(
        2,
        'T2-BOUND-03',
        '/limit ai 0 disables cooldown (subsequent calls allowed immediately)',
        enabled === '0' && cdZero.allowed === true
      );
    }

    // T2-BOUND-04: /limit sticker off and /limit sticker on toggle enable flag properly
    {
      mockBus.clear();
      await routeMessage(mockSock, createMockMsg({ sender: `${TEST_CONSTANTS.PHONE_DEVELOPER}@s.whatsapp.net`, text: '/limit sticker off' }));
      const offVal = db.prepare("SELECT value FROM bot_settings WHERE key = 'sticker_limit_enabled'").get()?.value;

      await routeMessage(mockSock, createMockMsg({ sender: `${TEST_CONSTANTS.PHONE_DEVELOPER}@s.whatsapp.net`, text: '/limit sticker on' }));
      const onVal = db.prepare("SELECT value FROM bot_settings WHERE key = 'sticker_limit_enabled'").get()?.value;

      recordTest(
        2,
        'T2-BOUND-04',
        '/limit sticker off and /limit sticker on toggle enable flag properly',
        offVal === '0' && onVal === '1'
      );
    }

    // T2-BOUND-05 to T2-BOUND-11: formatLimitDuration boundary assertions
    recordTest(2, 'T2-BOUND-05', 'Duration formatter boundary 0 seconds -> "0d"', formatLimitDuration(0) === '0d');
    recordTest(2, 'T2-BOUND-06', 'Duration formatter boundary 45 seconds -> "45d"', formatLimitDuration(45) === '45d');
    recordTest(2, 'T2-BOUND-07', 'Duration formatter boundary 59 seconds -> "59d"', formatLimitDuration(59) === '59d');
    recordTest(2, 'T2-BOUND-08', 'Duration formatter boundary 60 seconds -> "1m" (never "1m 0d")', formatLimitDuration(60) === '1m');
    recordTest(2, 'T2-BOUND-09', 'Duration formatter boundary 61 seconds -> "1m 1d"', formatLimitDuration(61) === '1m 1d');
    recordTest(2, 'T2-BOUND-10', 'Duration formatter boundary 90 seconds -> "1m 30d"', formatLimitDuration(90) === '1m 30d');
    recordTest(2, 'T2-BOUND-11', 'Duration formatter boundary 120 seconds -> "2m"', formatLimitDuration(120) === '2m');

    // T2-BOUND-12: Menu leak prevention: verify getHelpMenu() output does not contain /limit
    {
      const menu = getHelpMenu();
      const hasLimit = menu.includes('/limit') || menu.includes('.limit');
      recordTest(
        2,
        'T2-BOUND-12',
        'Menu leak prevention: verify getHelpMenu() output does not contain /limit',
        !hasLimit
      );
    }
  }

  // =========================================================================
  // TIER 3: CROSS-FEATURE INTERACTIONS
  // =========================================================================
  if (!targetTier || targetTier === 3) {
    console.log('──────────────────────────────────────────────────────────────────────');
    console.log('📋 TIER 3: CROSS-FEATURE INTERACTIONS (T3-CROSS-01 to T3-CROSS-05)');
    console.log('──────────────────────────────────────────────────────────────────────');

    // Self-contained precondition: Ensure Week 18 block schedule is synced if Tier 3 runs standalone
    const existingW18 = db.prepare('SELECT subject_name FROM schedules WHERE group_id = ? AND week_number = 18 AND day_index = 1').get(TEST_CONSTANTS.CLASS_XI_RPL_C);
    if (!existingW18 || existingW18.subject_name !== 'Kejuruan RPL (Bengkel / Praktik)') {
      await sekretarisClient.request('PUT', `/api/schedules/${mondayId}`, {
        body: {
          week_number: 18,
          day_index: 1,
          block_type: 'BENGKEL',
          subject_name: 'Kejuruan RPL (Bengkel / Praktik)',
          teacher_name: 'Guru Bengkel',
          room_name: 'Lab RPL / Bengkel',
          time_start: '07:50',
          time_end: '15:30',
          notes: 'Tier 3 Precondition Sync'
        }
      });
    }

    // T3-CROSS-01: Updating limit via /limit ai 90 immediately applies to router cooldown without process restart
    {
      mockBus.clear();
      await routeMessage(mockSock, createMockMsg({ sender: `${TEST_CONSTANTS.PHONE_DEVELOPER}@s.whatsapp.net`, text: '/limit ai 90' }));
      const cfg = getBotLimitConfig();
      resetAllUserCooldowns();
      recordUserCooldown('ai', 'user_cross_1');
      const cd = checkUserCooldown('ai', 'user_cross_1');
      recordTest(
        3,
        'T3-CROSS-01',
        'Updating limit via /limit ai 90 immediately applies to router cooldown without process restart',
        cfg.ai.window_seconds === 90 && cd.allowed === false && cd.window_seconds === 90
      );
    }

    // T3-CROSS-02: Schedule edit via PUT /api/schedules/:id immediately reflects in bot/modules/schedule.js getScheduleFull
    {
      const fullText = getScheduleFull(TEST_CONSTANTS.CLASS_XI_RPL_C, 18);
      const matches = (fullText.match(/Kejuruan RPL \(Bengkel \/ Praktik\)/g) || []).length;
      recordTest(
        3,
        'T3-CROSS-02',
        'Schedule edit via PUT /api/schedules/:id immediately reflects in getScheduleFull without duplicate items',
        matches === 1 && !fullText.includes('Mata Pelajaran Pilihan')
      );
    }

    // T3-CROSS-03: Schedule edit via PUT /api/schedules/:id immediately reflects across getScheduleByDay for Mon-Fri
    {
      // Temporarily adjust semester_start_date so calculateWeekNumber returns 18
      const d = new Date();
      d.setDate(d.getDate() - (17 * 7));
      const targetStartDate = d.toISOString().split('T')[0];
      db.prepare('UPDATE classes SET semester_start_date = ? WHERE group_id = ?').run(targetStartDate, TEST_CONSTANTS.CLASS_XI_RPL_C);

      const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat'];
      const dayOutputs = days.map(day => getScheduleByDay(TEST_CONSTANTS.CLASS_XI_RPL_C, day));
      const allDaysMatch = dayOutputs.every(out =>
        typeof out === 'string' &&
        out.includes('Kejuruan RPL (Bengkel / Praktik)') &&
        out.includes('Guru Bengkel')
      );
      recordTest(
        3,
        'T3-CROSS-03',
        'Schedule edit via PUT /api/schedules/:id immediately reflects across getScheduleByDay for Monday through Friday',
        allDaysMatch
      );
    }

    // T3-CROSS-04: Web dashboard deduplication function produces exactly 1 item for synchronized block week
    {
      const w18Items = db.prepare('SELECT * FROM schedules WHERE group_id = ? AND week_number = 18').all(TEST_CONSTANTS.CLASS_XI_RPL_C);
      // Run identical frontend deduplication algorithm from web/public/app.js
      const uniqueSchedules = [];
      const seenSubjects = new Set();
      for (const item of w18Items) {
        const key = `${(item.subject_name || '').trim().toLowerCase()}|${(item.teacher_name || '').trim().toLowerCase()}|${(item.room_name || '').trim().toLowerCase()}|${item.block_type}`;
        if (!seenSubjects.has(key)) {
          seenSubjects.add(key);
          uniqueSchedules.push(item);
        }
      }
      recordTest(
        3,
        'T3-CROSS-04',
        'Web dashboard deduplication function produces exactly 1 item for synchronized block week',
        uniqueSchedules.length === 1 && w18Items.length === 5
      );
    }

    // T3-CROSS-05: Updating sticker limit via /limit sticker updates bot_settings and is immediately seen by media.js
    {
      mockBus.clear();
      await routeMessage(mockSock, createMockMsg({ sender: `${TEST_CONSTANTS.PHONE_DEVELOPER}@s.whatsapp.net`, text: '/limit sticker 180' }));
      const stickerCfg = getStickerLimitConfig();
      recordTest(
        3,
        'T3-CROSS-05',
        'Updating sticker limit via /limit sticker updates bot_settings and is immediately seen by media.js',
        stickerCfg.window_seconds === 180 && stickerCfg.enabled === true
      );
    }
  }

  // =========================================================================
  // TIER 4: REAL-WORLD SCENARIOS
  // =========================================================================
  if (!targetTier || targetTier === 4) {
    console.log('──────────────────────────────────────────────────────────────────────');
    console.log('📋 TIER 4: REAL-WORLD SCENARIOS (T4-REAL-01 to T4-REAL-05)');
    console.log('──────────────────────────────────────────────────────────────────────');

    // T4-REAL-01: Spamming /ai burst: 1st call permitted, 2nd and 3rd calls blocked with formatted wait message
    {
      resetAllUserCooldowns();
      updateBotLimitConfig('ai', { enabled: true, window_seconds: 90 });
      const spammer = '6281200000021@s.whatsapp.net';

      // First call (permitted)
      const call1 = checkUserCooldown('ai', spammer);
      recordUserCooldown('ai', spammer);

      // Second and third calls (blocked)
      const call2 = checkUserCooldown('ai', spammer);
      mockBus.clear();
      await routeMessage(mockSock, createMockMsg({ sender: spammer, text: '/ai Pertanyaan spam kedua' }));
      const cdReply2 = mockBus.sent.find(m => m.content?.text && (m.content.text.includes('cooldown') || m.content.text.includes('tunggu')));

      const call3 = checkUserCooldown('ai', spammer);
      mockBus.clear();
      await routeMessage(mockSock, createMockMsg({ sender: spammer, text: '/ai Pertanyaan spam ketiga' }));
      const cdReply3 = mockBus.sent.find(m => m.content?.text && (m.content.text.includes('cooldown') || m.content.text.includes('tunggu')));

      recordTest(
        4,
        'T4-REAL-01',
        'Spamming /ai burst: 1st call permitted, 2nd and 3rd calls blocked with formatted wait message',
        call1.allowed === true && call2.allowed === false && call3.allowed === false && Boolean(cdReply2) && Boolean(cdReply3)
      );
    }

    // T4-REAL-02: Spamming /tt burst: 1st call permitted, 2nd call blocked with formatted wait message
    {
      resetAllUserCooldowns();
      updateBotLimitConfig('tt', { enabled: true, window_seconds: 60 });
      const ttSpammer = '6281200000022@s.whatsapp.net';

      const call1 = checkUserCooldown('tt', ttSpammer);
      recordUserCooldown('tt', ttSpammer);

      const call2 = checkUserCooldown('tt', ttSpammer);
      mockBus.clear();
      await routeMessage(mockSock, createMockMsg({ sender: ttSpammer, text: '/tt https://vt.tiktok.com/ZSj12345/' }));
      const cdReply = mockBus.sent.find(m => m.content?.text && (m.content.text.includes('cooldown') || m.content.text.includes('tunggu')));

      recordTest(
        4,
        'T4-REAL-02',
        'Spamming /tt burst: 1st call permitted, 2nd call blocked with formatted wait message',
        call1.allowed === true && call2.allowed === false && Boolean(cdReply)
      );
    }

    // T4-REAL-03: Per-user isolation: User A on cooldown does NOT block User B in the same group
    {
      resetAllUserCooldowns();
      updateBotLimitConfig('ai', { enabled: true, window_seconds: 60 });
      const userA = '6281200000023@s.whatsapp.net';
      const userB = '6281200000024@s.whatsapp.net';

      recordUserCooldown('ai', userA);
      const checkA = checkUserCooldown('ai', userA);
      const checkB = checkUserCooldown('ai', userB);

      recordTest(
        4,
        'T4-REAL-03',
        'Per-user isolation: User A on cooldown does NOT block User B in the same group',
        checkA.allowed === false && checkB.allowed === true
      );
    }

    // T4-REAL-04: Cooldown expiration: after simulated clock advance past window duration, user is permitted again
    {
      resetAllUserCooldowns();
      updateBotLimitConfig('ai', { enabled: true, window_seconds: 30 });
      const expUser = '6281200000025@s.whatsapp.net';

      const origNow = Date.now;
      try {
        // Record cooldown 35s in the past
        Date.now = () => origNow() - 35000;
        recordUserCooldown('ai', expUser);
        Date.now = origNow;

        const checkExp = checkUserCooldown('ai', expUser);
        recordTest(
          4,
          'T4-REAL-04',
          'Cooldown expiration: after simulated clock advance past window duration, user is permitted to query again',
          checkExp.allowed === true
        );
      } finally {
        Date.now = origNow;
      }
    }

    // T4-REAL-05: Full E2E flow: Web admin edits Week 18, verification queries confirm Monday through Friday updated, bot user requests /jadwal full 18
    {
      // 1. Web admin edits schedule via PUT API
      const apiRes = await sekretarisClient.request('PUT', `/api/schedules/${mondayId}`, {
        body: {
          week_number: 18,
          day_index: 1,
          block_type: 'BENGKEL',
          subject_name: 'Kejuruan RPL (Bengkel / Praktik)',
          teacher_name: 'Guru Bengkel',
          room_name: 'Lab RPL / Bengkel',
          time_start: '07:50',
          time_end: '15:30',
          notes: 'Full E2E Verification'
        }
      });

      // 2. Database verification: 5 rows exist, all synchronized
      const dbRows = db.prepare('SELECT * FROM schedules WHERE group_id = ? AND week_number = 18').all(TEST_CONSTANTS.CLASS_XI_RPL_C);
      const dbConsistent = dbRows.length === 5 && dbRows.every(r =>
        r.subject_name === 'Kejuruan RPL (Bengkel / Praktik)' &&
        r.teacher_name === 'Guru Bengkel' &&
        r.room_name === 'Lab RPL / Bengkel'
      );

      // 3. Bot user requests schedule for Week 18 via routeMessage (/jadwal 18)
      mockBus.clear();
      const userJadwalMsg = createMockMsg({ sender: `${TEST_CONSTANTS.PHONE_REGULAR_STUDENT}@s.whatsapp.net`, text: '/jadwal 18' });
      await routeMessage(mockSock, userJadwalMsg);
      const botResponse = mockBus.sent.find(m => m.content?.text && (m.content.text.includes('Minggu Ke-18') || m.content.text.includes('Kejuruan RPL')) );
      const text = botResponse?.content?.text || '';
      const subjectOccurrences = (text.match(/Kejuruan RPL \(Bengkel \/ Praktik\)/g) || []).length;
      const cleanSingleCard = subjectOccurrences === 1 && !text.includes('Mata Pelajaran Pilihan');

      // 4. Also verify direct getScheduleFull(groupId, 18)
      const directText = getScheduleFull(TEST_CONSTANTS.CLASS_XI_RPL_C, 18);
      const directMatches = (directText.match(/Kejuruan RPL \(Bengkel \/ Praktik\)/g) || []).length;
      const directClean = directMatches === 1 && !directText.includes('Mata Pelajaran Pilihan');

      recordTest(
        4,
        'T4-REAL-05',
        'Full E2E flow: Web admin edits Week 18, verification queries confirm Monday through Friday updated, bot user requests /jadwal 18 and receives clean single card',
        apiRes.status === 200 && dbConsistent && cleanSingleCard && directClean
      );
    }
  }

} catch (err) {
  console.error('\n❌ CRITICAL UNHANDLED ERROR IN TEST RUNNER:', err);
  stats.totalFailed++;
  stats.failures.push(`Critical Runner Exception: ${err.message}`);
} finally {
  // Teardown: Close Web Server
  try {
    server.close();
  } catch {}

  // Teardown: Close SQLite DB & Unlink ephemeral files
  try {
    db.close();
  } catch {}

  for (const suffix of ['', '-wal', '-shm']) {
    const f = `${tempDbPath}${suffix}`;
    if (fs.existsSync(f)) {
      try {
        fs.unlinkSync(f);
      } catch {}
    }
  }
}

// ============================================================================
// FINAL SUMMARY REPORT
// ============================================================================
console.log('\n======================================================================');
console.log('📊 FINAL TEST RESULTS & COVERAGE MATRIX:');
console.log('======================================================================');
for (let t = 1; t <= 4; t++) {
  if (!targetTier || targetTier === t) {
    const item = stats.byTier[t];
    const status = item.failed === 0 && item.passed === item.target ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${status} ${item.name}: ${item.passed}/${item.target} passed (${item.failed} failed)`);
  }
}
console.log('──────────────────────────────────────────────────────────────────────');
console.log(`🎯 TOTAL SUMMARY: ${stats.totalPassed} PASSED, ${stats.totalFailed} FAILED (TOTAL: ${stats.totalPassed + stats.totalFailed} TESTS)`);
console.log('======================================================================\n');

if (stats.totalFailed > 0) {
  console.error('❌ FAILURES DETECTED:');
  for (const fail of stats.failures) {
    console.error(`  • ${fail}`);
  }
  process.exit(1);
} else {
  console.log('🎉 100% OF ALL SPECIFIED E2E TESTS PASSED SUCCESSFULLY!\n');
  process.exit(0);
}
