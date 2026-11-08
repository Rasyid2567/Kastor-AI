/**
 * ============================================================================
 * KASTOR AI — ADVERSARIAL STRESS TEST SUITE: RATE LIMITS & /LIMIT COMMAND
 * ============================================================================
 * Empirically stress-tests the Rate Limiting and Secret /limit Command:
 * 
 * 1. High Concurrency Burst:
 *    - 100 concurrent requests for a single user to checkUserCooldown & recordUserCooldown
 *    - 100 concurrent requests across multiple users
 *    - Cross-service concurrency (ai, tt, sticker)
 *    - Interleaved rapid record/check/clear cycles
 * 
 * 2. Rapid State Changes & SQLite Transaction Integrity:
 *    - 100 rapid consecutive / interleaved updates to updateBotLimitConfig
 *    - Verification of SQLite WAL transaction integrity and pragma check
 *    - Rollback and exception safety on invalid types
 * 
 * 3. Adversarial Inputs to formatLimitDuration:
 *    - Boundaries: 0, 1, 59, 60, 61, 89, 90, 119, 120, 150, 3599, 3600
 *    - Edge cases: -10, NaN, '90', null, undefined
 *    - Robustness tests: empty string, non-numeric strings, Infinity, objects, arrays, floats
 * 
 * 4. Mock Message Bursts to Router for AI & Downloader Commands:
 *    - 50-message burst to /ai (exactly 1 allowed, 49 blocked)
 *    - 50-message burst to /tt (exactly 1 allowed, 49 blocked)
 *    - Alias bypass resistance (/ai -> /tanya, @mention)
 *    - Downloader alias bypass resistance (/tt -> /yt -> /ig -> /fb)
 *    - Cross-context bypass resistance (Group -> Private Message)
 *    - Adversarial input injection on /limit (SQLi, prototype pollution, large strings)
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ephemeral Database isolation in /tmp/
const tempDbPath = `/tmp/kastor_stress_${Date.now()}_${process.pid}.sqlite`;
process.env.DATABASE_PATH = tempDbPath;
process.env.DEVELOPER_NUMBER = process.env.DEVELOPER_NUMBER || '6285155054456';

// Dynamic imports
const { db, initDatabase } = await import('../database/schema.js');
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

const stats = {
  totalPassed: 0,
  totalFailed: 0,
  suites: {}
};

function recordTest(suiteName, testId, description, passed, errorMsg = '') {
  if (!stats.suites[suiteName]) {
    stats.suites[suiteName] = { passed: 0, failed: 0 };
  }
  if (passed) {
    stats.totalPassed++;
    stats.suites[suiteName].passed++;
    console.log(`  ✅ [PASS] [${testId}] ${description}`);
  } else {
    stats.totalFailed++;
    stats.suites[suiteName].failed++;
    console.error(`  ❌ [FAIL] [${testId}] ${description} — ${errorMsg}`);
  }
}

// Baileys Mock
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

console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║       KASTOR AI — EMPIRICAL ADVERSARIAL STRESS TEST SUITE            ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');
console.log(`📂 Ephemeral Test Database: ${tempDbPath}`);
console.log(`⏱️  Timestamp: ${new Date().toISOString()}`);

// Initialize ephemeral DB
initDatabase();
seedTestDatabase(db);
const mockSock = createMockSocket(mockBus);

try {
  // ==========================================================================
  // SUITE 1: HIGH CONCURRENCY BURST
  // ==========================================================================
  console.log('\n──────────────────────────────────────────────────────────────────────');
  console.log('📋 SUITE 1: HIGH CONCURRENCY BURST & THREAD/MEMORY SAFETY');
  console.log('──────────────────────────────────────────────────────────────────────');

  // S1.1: 100 concurrent requests for single user
  {
    resetAllUserCooldowns();
    updateBotLimitConfig('ai', { enabled: true, window_seconds: 30 });
    const userId = 'user_concurrent_single';

    // Fire 100 concurrent requests
    const results = await Promise.all(
      Array.from({ length: 100 }, async (_, idx) => {
        const cd = checkUserCooldown('ai', userId);
        if (cd.allowed) {
          recordUserCooldown('ai', userId);
          return { idx, allowed: true };
        }
        return { idx, allowed: false, remaining: cd.remaining_seconds };
      })
    );

    const allowedCount = results.filter(r => r.allowed).length;
    const blockedCount = results.filter(r => !r.allowed).length;
    const allBlockedHaveRemaining = results
      .filter(r => !r.allowed)
      .every(r => typeof r.remaining === 'number' && r.remaining > 0);

    recordTest(
      'SUITE 1',
      'S1-CONC-01',
      '100 concurrent requests from single user: exactly 1 allowed, 99 blocked with valid remaining seconds',
      allowedCount === 1 && blockedCount === 99 && allBlockedHaveRemaining,
      `Allowed: ${allowedCount}, Blocked: ${blockedCount}`
    );
  }

  // S1.2: 100 concurrent requests across 100 distinct users
  {
    resetAllUserCooldowns();
    updateBotLimitConfig('ai', { enabled: true, window_seconds: 30 });

    const wave1 = await Promise.all(
      Array.from({ length: 100 }, async (_, idx) => {
        const uId = `multi_user_${idx}`;
        const cd = checkUserCooldown('ai', uId);
        if (cd.allowed) {
          recordUserCooldown('ai', uId);
          return true;
        }
        return false;
      })
    );

    const wave1AllAllowed = wave1.every(v => v === true);

    // Wave 2: immediate second concurrent burst across the same 100 users
    const wave2 = await Promise.all(
      Array.from({ length: 100 }, async (_, idx) => {
        const uId = `multi_user_${idx}`;
        const cd = checkUserCooldown('ai', uId);
        return cd.allowed;
      })
    );

    const wave2AllBlocked = wave2.every(v => v === false);

    recordTest(
      'SUITE 1',
      'S1-CONC-02',
      '100 distinct users: wave 1 (100% allowed), wave 2 (100% blocked under cooldown)',
      wave1AllAllowed && wave2AllBlocked,
      `Wave 1 allowed: ${wave1.filter(Boolean).length}/100, Wave 2 blocked: ${wave2.filter(v => !v).length}/100`
    );
  }

  // S1.3: Cross-service concurrency isolation (ai, tt, sticker)
  {
    resetAllUserCooldowns();
    updateBotLimitConfig('ai', { enabled: true, window_seconds: 40 });
    updateBotLimitConfig('tt', { enabled: true, window_seconds: 60 });
    updateBotLimitConfig('sticker', { enabled: true, window_seconds: 120 });

    const uId = 'cross_service_user';
    // User triggers ai cooldown
    recordUserCooldown('ai', uId);

    // Concurrent check on ai, tt, and sticker
    const [cdAi, cdTt, cdSticker] = await Promise.all([
      Promise.resolve(checkUserCooldown('ai', uId)),
      Promise.resolve(checkUserCooldown('tt', uId)),
      Promise.resolve(checkUserCooldown('sticker', uId))
    ]);

    const isolated = !cdAi.allowed && cdTt.allowed && cdSticker.allowed;
    recordTest(
      'SUITE 1',
      'S1-CONC-03',
      'Cross-service concurrency isolation: cooldown on AI does NOT block TT or Sticker for same user',
      isolated,
      `AI: ${cdAi.allowed}, TT: ${cdTt.allowed}, Sticker: ${cdSticker.allowed}`
    );
  }

  // S1.4: 100 rapid interleaved cycles of record -> check -> clear
  {
    resetAllUserCooldowns();
    updateBotLimitConfig('ai', { enabled: true, window_seconds: 60 });

    let errorsEncountered = 0;
    await Promise.all(
      Array.from({ length: 100 }, async (_, idx) => {
        const uId = `cycle_user_${idx % 10}`;
        try {
          recordUserCooldown('ai', uId);
          const mid = checkUserCooldown('ai', uId);
          if (mid.allowed) errorsEncountered++;
          clearUserCooldown('ai', uId);
          const post = checkUserCooldown('ai', uId);
          if (!post.allowed) errorsEncountered++;
        } catch {
          errorsEncountered++;
        }
      })
    );

    recordTest(
      'SUITE 1',
      'S1-CONC-04',
      '100 interleaved record/check/clear cycles complete without map corruption or race leaks',
      errorsEncountered === 0,
      `Errors: ${errorsEncountered}`
    );
  }

  // ==========================================================================
  // SUITE 2: RAPID STATE CHANGES & SQLITE TRANSACTION INTEGRITY
  // ==========================================================================
  console.log('\n──────────────────────────────────────────────────────────────────────');
  console.log('📋 SUITE 2: RAPID STATE CHANGES & SQLITE TRANSACTION INTEGRITY');
  console.log('──────────────────────────────────────────────────────────────────────');

  // S2.1: 100 rapid consecutive updates to updateBotLimitConfig
  {
    const services = ['sticker', 'ai', 'tt'];
    const testWindows = [10, 20, 30, 45, 60, 90, 120, 180, 0];
    let updateErrors = 0;

    for (let i = 0; i < 100; i++) {
      const srv = services[i % services.length];
      const win = testWindows[i % testWindows.length];
      const en = win > 0 ? (i % 2 === 0) : false;
      try {
        updateBotLimitConfig(srv, { enabled: en, window_seconds: win });
      } catch (err) {
        updateErrors++;
      }
    }

    recordTest(
      'SUITE 2',
      'S2-TRANS-01',
      '100 rapid consecutive updateBotLimitConfig executions succeed without lock or transaction conflicts',
      updateErrors === 0,
      `Update errors: ${updateErrors}`
    );
  }

  // S2.2: Transaction state verification & database consistency
  {
    // Set known final states
    updateBotLimitConfig('sticker', { enabled: true, window_seconds: 150 });
    updateBotLimitConfig('ai', { enabled: true, window_seconds: 45 });
    updateBotLimitConfig('tt', { enabled: false, window_seconds: 90 });

    const cfg = getBotLimitConfig();
    const isExact =
      cfg.sticker.enabled === true && cfg.sticker.window_seconds === 150 &&
      cfg.ai.enabled === true && cfg.ai.window_seconds === 45 &&
      cfg.tt.enabled === false && cfg.tt.window_seconds === 90;

    recordTest(
      'SUITE 2',
      'S2-TRANS-02',
      'getBotLimitConfig accurately reflects latest transaction-committed values',
      isExact,
      `Config: ${JSON.stringify(cfg)}`
    );
  }

  // S2.3: SQLite PRAGMA integrity check & duplicate key verification
  {
    const pragmaRes = db.prepare('PRAGMA integrity_check').get();
    const isIntegrityOk = pragmaRes && pragmaRes.integrity_check === 'ok';

    // Verify exactly 1 row per setting key
    const duplicateCheck = db.prepare(`
      SELECT key, COUNT(*) as count 
      FROM bot_settings 
      WHERE key IN ('sticker_limit_enabled', 'sticker_limit_window_seconds', 'ai_limit_enabled', 'ai_limit_window_seconds', 'tt_limit_enabled', 'tt_limit_window_seconds')
      GROUP BY key
      HAVING count > 1
    `).all();

    const noDuplicates = duplicateCheck.length === 0;

    recordTest(
      'SUITE 2',
      'S2-TRANS-03',
      'PRAGMA integrity_check returns ok and no duplicate bot_settings rows exist',
      isIntegrityOk && noDuplicates,
      `Integrity: ${pragmaRes?.integrity_check}, Duplicates: ${duplicateCheck.length}`
    );
  }

  // S2.4: Rollback and exception safety on invalid types
  {
    let caughtInvalidType = false;
    try {
      updateBotLimitConfig('invalid_type', { enabled: true, window_seconds: 30 });
    } catch {
      caughtInvalidType = true;
    }

    // Ensure database connection is clean and capable of running subsequent transactions
    let subSucceeded = false;
    try {
      updateBotLimitConfig('ai', { enabled: true, window_seconds: 30 });
      subSucceeded = true;
    } catch {
      subSucceeded = false;
    }

    recordTest(
      'SUITE 2',
      'S2-TRANS-04',
      'Invalid type throws cleanly, rollback executes, and subsequent transactions succeed',
      caughtInvalidType && subSucceeded,
      `Caught: ${caughtInvalidType}, Subsequent OK: ${subSucceeded}`
    );
  }

  // ==========================================================================
  // SUITE 3: ADVERSARIAL INPUTS TO formatLimitDuration
  // ==========================================================================
  console.log('\n──────────────────────────────────────────────────────────────────────');
  console.log('📋 SUITE 3: ADVERSARIAL INPUTS TO formatLimitDuration');
  console.log('──────────────────────────────────────────────────────────────────────');

  const requiredInputs = [
    { input: 0, expected: '0d' },
    { input: 1, expected: '1d' },
    { input: 59, expected: '59d' },
    { input: 60, expected: '1m' },
    { input: 61, expected: '1m 1d' },
    { input: 89, expected: '1m 29d' },
    { input: 90, expected: '1m 30d' },
    { input: 119, expected: '1m 59d' },
    { input: 120, expected: '2m' },
    { input: 150, expected: '2m 30d' },
    { input: 3599, expected: '59m 59d' },
    { input: 3600, expected: '60m' },
    { input: -10, expected: '0d' },
    { input: NaN, expected: '0d' },
    { input: '90', expected: '1m 30d' },
    { input: null, expected: '0d' },
    { input: undefined, expected: '0d' }
  ];

  let boundaryFailures = [];
  for (const item of requiredInputs) {
    const actual = formatLimitDuration(item.input);
    if (actual !== item.expected) {
      boundaryFailures.push(`input: ${item.input} -> expected "${item.expected}", got "${actual}"`);
    }
  }

  recordTest(
    'SUITE 3',
    'S3-INPUT-01',
    '17 required adversarial/boundary inputs produce exact expected formatted strings',
    boundaryFailures.length === 0,
    boundaryFailures.join('; ')
  );

  // Additional extreme edge cases
  const edgeCases = [
    { input: '', expected: '0d' },
    { input: 'abc', expected: '0d' },
    { input: '   ', expected: '0d' },
    { input: Infinity, expected: '0d' },
    { input: -Infinity, expected: '0d' },
    { input: {}, expected: '0d' },
    { input: [], expected: '0d' },
    { input: 120.9, expected: '2m' },
    { input: 0.9, expected: '0d' },
    { input: 7200, expected: '120m' },
    { input: 7245, expected: '120m 45d' }
  ];

  let edgeFailures = [];
  for (const item of edgeCases) {
    try {
      const actual = formatLimitDuration(item.input);
      if (actual !== item.expected) {
        edgeFailures.push(`input: ${String(item.input)} -> expected "${item.expected}", got "${actual}"`);
      }
    } catch (e) {
      edgeFailures.push(`input: ${String(item.input)} threw: ${e.message}`);
    }
  }

  recordTest(
    'SUITE 3',
    'S3-INPUT-02',
    'Additional extreme edge cases (Infinity, strings, floats, objects) never throw and format cleanly',
    edgeFailures.length === 0,
    edgeFailures.join('; ')
  );

  // ==========================================================================
  // SUITE 4: MOCK MESSAGE BURSTS TO ROUTER (COOLDOWN LEAK / BYPASS DEFENSE)
  // ==========================================================================
  console.log('\n──────────────────────────────────────────────────────────────────────');
  console.log('📋 SUITE 4: MOCK MESSAGE BURSTS & ROUTER COOLDOWN BYPASS DEFENSE');
  console.log('──────────────────────────────────────────────────────────────────────');

  // S4.1: 50-message burst to /ai in group
  {
    resetAllUserCooldowns();
    updateBotLimitConfig('ai', { enabled: true, window_seconds: 30 });
    const spammer = '6289900000001@s.whatsapp.net';
    mockBus.clear();

    for (let i = 0; i < 50; i++) {
      const msg = createMockMsg({ sender: spammer, text: `/ai Pertanyaan spam ke-${i}` });
      await routeMessage(mockSock, msg);
    }

    // 1st call triggers AI (or prompts error/composing), subsequent 49 calls MUST receive cooldown message
    const cooldownReplies = mockBus.sent.filter(
      m => m.content?.text && (m.content.text.includes('cooldown') || m.content.text.includes('Mohon tunggu'))
    );

    recordTest(
      'SUITE 4',
      'S4-BURST-01',
      '50 consecutive /ai messages from same user: 49 blocked with formatted cooldown message, zero bypass leaks',
      cooldownReplies.length === 49,
      `Cooldown replies: ${cooldownReplies.length}/49`
    );
  }

  // S4.2: 50-message burst to Downloader (/tt)
  {
    resetAllUserCooldowns();
    updateBotLimitConfig('tt', { enabled: true, window_seconds: 60 });
    const ttSpammer = '6289900000002@s.whatsapp.net';
    mockBus.clear();

    for (let i = 0; i < 50; i++) {
      const msg = createMockMsg({ sender: ttSpammer, text: `/tt https://vt.tiktok.com/ZSj${i}/` });
      await routeMessage(mockSock, msg);
    }

    const ttCooldownReplies = mockBus.sent.filter(
      m => m.content?.text && (m.content.text.includes('cooldown') || m.content.text.includes('Mohon tunggu'))
    );

    recordTest(
      'SUITE 4',
      'S4-BURST-02',
      '50 consecutive /tt messages from same user: 49 blocked with formatted cooldown message, zero bypass leaks',
      ttCooldownReplies.length === 49,
      `Cooldown replies: ${ttCooldownReplies.length}/49`
    );
  }

  // S4.3: Alias bypass attack: /ai -> /tanya -> @bot mention
  {
    resetAllUserCooldowns();
    updateBotLimitConfig('ai', { enabled: true, window_seconds: 30 });
    const userAlias = '6289900000003@s.whatsapp.net';
    mockBus.clear();

    // 1. Initial call via /ai
    await routeMessage(mockSock, createMockMsg({ sender: userAlias, text: '/ai Apa kabar?' }));

    // 2. Immediate alias attempt via /tanya
    mockBus.clear();
    await routeMessage(mockSock, createMockMsg({ sender: userAlias, text: '/tanya Siapa penemu komputer?' }));
    const tanyaBlocked = mockBus.sent.some(
      m => m.content?.text && m.content.text.includes('cooldown')
    );

    // 3. Immediate alias attempt via @bot mention
    mockBus.clear();
    const botJid = `${TEST_CONSTANTS.PHONE_DEVELOPER}@s.whatsapp.net`;
    const mentionMsg = {
      key: {
        remoteJid: TEST_CONSTANTS.CLASS_XI_RPL_C,
        participant: userAlias,
        fromMe: false,
        id: `mock_mention_${Date.now()}`
      },
      message: {
        extendedTextMessage: {
          text: `@${TEST_CONSTANTS.PHONE_DEVELOPER} tolong bantu tugas ini`,
          contextInfo: {
            mentionedJid: [botJid]
          }
        }
      },
      messageTimestamp: Math.floor(Date.now() / 1000)
    };
    await routeMessage(mockSock, mentionMsg);
    const mentionBlocked = mockBus.sent.some(
      m => m.content?.text && m.content.text.includes('cooldown')
    );

    recordTest(
      'SUITE 4',
      'S4-BURST-03',
      'Bypass attempts using /tanya and @bot mention are strictly blocked under active AI cooldown',
      tanyaBlocked && mentionBlocked,
      `/tanya blocked: ${tanyaBlocked}, @mention blocked: ${mentionBlocked}`
    );
  }

  // S4.4: Downloader alias bypass attack: /tt -> /yt -> /ig -> /fb
  {
    resetAllUserCooldowns();
    updateBotLimitConfig('tt', { enabled: true, window_seconds: 60 });
    const dlUser = '6289900000004@s.whatsapp.net';
    mockBus.clear();

    // 1. Trigger via /tt
    await routeMessage(mockSock, createMockMsg({ sender: dlUser, text: '/tt https://vt.tiktok.com/ZSj111/' }));

    // 2. Immediate attempt via /yt
    mockBus.clear();
    await routeMessage(mockSock, createMockMsg({ sender: dlUser, text: '/yt https://youtube.com/watch?v=123' }));
    const ytBlocked = mockBus.sent.some(m => m.content?.text && m.content.text.includes('cooldown'));

    // 3. Immediate attempt via /ig
    mockBus.clear();
    await routeMessage(mockSock, createMockMsg({ sender: dlUser, text: '/ig https://instagram.com/reel/123' }));
    const igBlocked = mockBus.sent.some(m => m.content?.text && m.content.text.includes('cooldown'));

    // 4. Immediate attempt via /fb
    mockBus.clear();
    await routeMessage(mockSock, createMockMsg({ sender: dlUser, text: '/fb https://facebook.com/watch/123' }));
    const fbBlocked = mockBus.sent.some(m => m.content?.text && m.content.text.includes('cooldown'));

    recordTest(
      'SUITE 4',
      'S4-BURST-04',
      'Downloader aliases (/yt, /ig, /fb) are all blocked when user is on /tt cooldown',
      ytBlocked && igBlocked && fbBlocked,
      `/yt: ${ytBlocked}, /ig: ${igBlocked}, /fb: ${fbBlocked}`
    );
  }

  // S4.5: Cross-context bypass attack: Group -> Private Message
  {
    resetAllUserCooldowns();
    updateBotLimitConfig('ai', { enabled: true, window_seconds: 45 });
    const userContext = '6289900000005@s.whatsapp.net';

    // 1. Trigger cooldown in Group
    mockBus.clear();
    await routeMessage(mockSock, createMockMsg({ sender: userContext, text: '/ai Tes di grup', isGroup: true }));

    // 2. Attempt bypass by sending /ai in PM (isGroup = false)
    mockBus.clear();
    await routeMessage(mockSock, createMockMsg({ sender: userContext, text: '/ai Tes di PM', isGroup: false }));
    const pmBlocked = mockBus.sent.some(m => m.content?.text && m.content.text.includes('cooldown'));

    recordTest(
      'SUITE 4',
      'S4-BURST-05',
      'Cross-context bypass attack: User on cooldown in group is blocked in Private Message',
      pmBlocked,
      `PM Blocked: ${pmBlocked}`
    );
  }

  // S4.6: Adversarial input injection on /limit command
  {
    const devJid = `${TEST_CONSTANTS.PHONE_DEVELOPER}@s.whatsapp.net`;
    const injectionAttacks = [
      "'; DROP TABLE bot_settings; --",
      "__proto__ 100",
      "constructor 100",
      "ai ' OR 1=1 --",
      "ai " + "9".repeat(100),
      "ai 0x1F",
      "sticker " + "A".repeat(10000)
    ];

    let injectionCrashes = 0;
    for (const payload of injectionAttacks) {
      mockBus.clear();
      try {
        await routeMessage(mockSock, createMockMsg({ sender: devJid, text: `/limit ${payload}` }));
      } catch (err) {
        injectionCrashes++;
      }
    }

    // Verify bot_settings still exists and is healthy
    const rowCheck = db.prepare('SELECT COUNT(*) as c FROM bot_settings').get();
    const tableIntact = rowCheck && rowCheck.c > 0;

    recordTest(
      'SUITE 4',
      'S4-BURST-06',
      'Adversarial input injections on /limit (SQLi, proto, overflow) handled safely with zero crashes',
      injectionCrashes === 0 && tableIntact,
      `Crashes: ${injectionCrashes}, Table intact: ${tableIntact}`
    );
  }

} finally {
  // Cleanup ephemeral database files
  try {
    db.close();
  } catch {}
  for (const ext of ['', '-wal', '-shm']) {
    try {
      if (fs.existsSync(tempDbPath + ext)) {
        fs.unlinkSync(tempDbPath + ext);
      }
    } catch {}
  }
}

// ============================================================================
// FINAL SUMMARY & EXIT
// ============================================================================
console.log('\n======================================================================');
console.log('📊 FINAL ADVERSARIAL STRESS TEST SUMMARY');
console.log('======================================================================');
for (const [suite, s] of Object.entries(stats.suites)) {
  const status = s.failed === 0 ? '✅ PASS' : '❌ FAIL';
  console.log(`  ${status} ${suite}: ${s.passed} passed, ${s.failed} failed`);
}
console.log('──────────────────────────────────────────────────────────────────────');
console.log(`🎯 TOTAL: ${stats.totalPassed} PASSED, ${stats.totalFailed} FAILED (TOTAL: ${stats.totalPassed + stats.totalFailed} TESTS)`);
console.log('======================================================================\n');

if (stats.totalFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
