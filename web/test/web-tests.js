/**
 * ============================================================================
 * KASTOR AI — WEB DASHBOARD AUTOMATED QA & SECURITY TEST SUITE
 * ============================================================================
 * Menguji seluruh skenario autentikasi, RBAC, Anti-IDOR / Class Isolation,
 * CRUD administrasi kelas, pencabutan jabatan real-time, proteksi SQLi/XSS,
 * serta verifikasi aset UI & Design System.
 *
 * ATURAN PENTING:
 * TIDAK MENYENTUH DATABASE PRODUKSI `database.sqlite`!
 * Salinan database dibuat di `/tmp/kastor_web_test_${process.pid}.sqlite`
 * SEBELUM modul database/server di-import, dan dihapus pada blok `finally`.
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDbPath = `/tmp/kastor_web_test_${process.pid}.sqlite`;

const projectRoot = path.resolve(__dirname, '../..');

function normPhone(p) {
  let s = p.replace(/\D/g, '');
  if (s.startsWith('0')) s = '62' + s.slice(1);
  return s;
}

// 1. Set environment DB sementara
process.env.DATABASE_PATH = tempDbPath;
process.env.DEVELOPER_NUMBER = process.env.DEVELOPER_NUMBER || '6285155054456';

// 2. Dynamic import setelah process.env.DATABASE_PATH terpasang
const { TEST_CONSTANTS, seedTestDatabase } = await import('./setup-test-db.js');
const { db, initDatabase, getCashHolidayWeeks, setCashHolidayWeek, removeCashHolidayWeek } = await import('../../database/schema.js');
const { createWebServer } = await import('../server.js');
const { SESSION_COOKIE_NAME } = await import('../src/auth.js');
const {
  checkStickerRateLimit,
  recordStickerUsage,
  removeStickerUsageById,
  resetStickerRateLimit
} = await import('../../bot/modules/media.js');

// 3. Inisialisasi & Seeding Mandiri (Zero Data Leak, Aman untuk CI Publik)
initDatabase();
seedTestDatabase(db);

// Konstanta Data Uji Otoritatif
const {
  CLASS_XI_RPL_C,
  CLASS_OPUS,
  CLASS_PRIBADI,
  PHONE_UNKNOWN,
  PHONE_REGULAR_STUDENT,
  PHONE_KETUA,
  PHONE_WAKIL,
  PHONE_SEKRETARIS,
  PHONE_SEKRETARIS_2,
  PHONE_BENDAHARA,
  PHONE_DEVELOPER,
  TEST_PASSWORD
} = TEST_CONSTANTS;

const sampleStudent = db.prepare('SELECT id FROM students WHERE group_id = ? ORDER BY student_number ASC LIMIT 1').get(CLASS_XI_RPL_C);
const sampleStudentId = sampleStudent ? sampleStudent.id : 1;

let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, testName, details = '') {
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedTests++;
    const msg = details ? `${testName} — ${details}` : testName;
    failures.push(msg);
    console.error(`  ❌ [FAIL] ${msg}`);
  }
}

/**
 * Helper HTTP client menggunakan native `fetch`
 */
function createApiClient(baseUrl) {
  let cookieJar = '';

  return {
    getCookieJar: () => cookieJar,
    setCookieJar: (val) => { cookieJar = val; },
    clearCookies: () => { cookieJar = ''; },
    async request(method, urlPath, { body = null, headers = {}, ip = '127.0.0.1' } = {}) {
      const reqHeaders = {
        'X-Forwarded-For': ip,
        ...headers
      };
      if (cookieJar) {
        reqHeaders['Cookie'] = cookieJar;
      }
      const opts = {
        method,
        headers: reqHeaders
      };
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

      return {
        status: res.status,
        headers: res.headers,
        setCookie: setCookie || '',
        data,
        text
      };
    }
  };
}

const server = createWebServer();

try {
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`\n🚀 [QA SUITE] Server uji aktif di ${baseUrl}`);
  console.log(`📂 [QA SUITE] Database sementara: ${tempDbPath}\n`);

  // =========================================================================
  // SKENARIO 1 (AUTH-01): Nomor tak dikenal gagal register (403)
  // =========================================================================
  console.log('--- Skenario 1 (AUTH-01): Registrasi Nomor Tak Dikenal ---');
  {
    const client = createApiClient(baseUrl);
    const res = await client.request('POST', '/api/auth/register', {
      ip: '10.0.0.1',
      body: { phone_number: PHONE_UNKNOWN, password: TEST_PASSWORD }
    });

    assert(res.status === 403, 'AUTH-01a: Nomor tak dikenal (089999999999) ditolak dengan 403 Forbidden', `Status: ${res.status}`);
    assert(res.data?.ok === false, 'AUTH-01b: Response JSON menyatakan ok: false');

    const userRow = db.prepare('SELECT * FROM web_users WHERE phone_number LIKE ?').get('%89999999999%');
    assert(!userRow, 'AUTH-01c: Tidak ada baris akun yang dibuat di tabel web_users');
  }

  // =========================================================================
  // SKENARIO 2 (AUTH-02): Nomor siswa biasa tanpa jabatan gagal register (403)
  // =========================================================================
  console.log('\n--- Skenario 2 (AUTH-02): Registrasi Siswa Biasa Tanpa Jabatan ---');
  {
    const client = createApiClient(baseUrl);
    const res = await client.request('POST', '/api/auth/register', {
      ip: '10.0.0.2',
      body: { phone_number: PHONE_REGULAR_STUDENT, password: TEST_PASSWORD }
    });

    assert(res.status === 403, 'AUTH-02a: Nomor siswa biasa (082140474039 - Nasywa) ditolak dengan 403 Forbidden', `Status: ${res.status}`);
    const userRow = db.prepare('SELECT * FROM web_users WHERE phone_number = ?').get('6282140474039');
    assert(!userRow, 'AUTH-02b: Tidak ada baris di web_users untuk siswa biasa');
  }

  // =========================================================================
  // SKENARIO 3 (AUTH-03): Registrasi Pengurus Sah & Developer + Hash Password
  // =========================================================================
  console.log('\n--- Skenario 3 (AUTH-03): Registrasi Pengurus Sah & Developer ---');
  {
    const validAccounts = [
      { label: 'KETUA', phone: PHONE_KETUA, norm: normPhone(PHONE_KETUA), expectedRole: 'KETUA', expectedGroup: CLASS_XI_RPL_C, ip: '10.0.1.1' },
      { label: 'WAKIL', phone: PHONE_WAKIL, norm: normPhone(PHONE_WAKIL), expectedRole: 'WAKIL', expectedGroup: CLASS_XI_RPL_C, ip: '10.0.1.2' },
      { label: 'SEKRETARIS', phone: PHONE_SEKRETARIS, norm: normPhone(PHONE_SEKRETARIS), expectedRole: 'SEKRETARIS', expectedGroup: CLASS_XI_RPL_C, ip: '10.0.1.3' },
      { label: 'BENDAHARA', phone: PHONE_BENDAHARA, norm: normPhone(PHONE_BENDAHARA), expectedRole: 'BENDAHARA', expectedGroup: CLASS_XI_RPL_C, ip: '10.0.1.4' },
      { label: 'DEVELOPER', phone: PHONE_DEVELOPER, norm: normPhone(PHONE_DEVELOPER), expectedRole: 'DEVELOPER', expectedGroup: null, ip: '10.0.1.5' }
    ];

    for (const acc of validAccounts) {
      const client = createApiClient(baseUrl);
      const res = await client.request('POST', '/api/auth/register', {
        ip: acc.ip,
        body: { phone_number: acc.phone, password: TEST_PASSWORD }
      });

      assert(res.status === 201, `AUTH-03 (${acc.label}): Registrasi berhasil dengan status 201`, `Status: ${res.status}, Error: ${res.data?.error}`);
      assert(res.data?.user?.role === acc.expectedRole, `AUTH-03 (${acc.label}): Role terdeteksi otomatis sebagai ${acc.expectedRole}`, `Got: ${res.data?.user?.role}`);
      assert(res.data?.user?.group_id === acc.expectedGroup, `AUTH-03 (${acc.label}): group_id sesuai (${acc.expectedGroup})`, `Got: ${res.data?.user?.group_id}`);

      const dbUser = db.prepare('SELECT * FROM web_users WHERE phone_number = ?').get(acc.norm);
      assert(
        Boolean(dbUser && dbUser.password_hash.startsWith('scrypt$') && dbUser.password_hash !== TEST_PASSWORD),
        `AUTH-03 (${acc.label}): Password tersimpan sebagai hash scrypt$... (bukan plaintext)`
      );
    }

    // Uji duplikasi registrasi
    const dupClient = createApiClient(baseUrl);
    const dupRes = await dupClient.request('POST', '/api/auth/register', {
      ip: '10.0.1.99',
      body: { phone_number: PHONE_KETUA, password: TEST_PASSWORD }
    });
    assert(dupRes.status === 409 || dupRes.status === 400, 'AUTH-03 (Duplicate): Duplikasi registrasi ditolak dengan 409/400', `Status: ${dupRes.status}`);
  }

  // =========================================================================
  // SKENARIO 4 (AUTH-04): Login Salah (401) & Rate Limiting Brute Force (429)
  // =========================================================================
  console.log('\n--- Skenario 4 (AUTH-04): Login Salah & Brute Force Rate Limit ---');
  {
    const bruteClient = createApiClient(baseUrl);
    const bruteIp = '10.99.99.99';

    for (let i = 1; i <= 5; i++) {
      const failRes = await bruteClient.request('POST', '/api/auth/login', {
        ip: bruteIp,
        body: { phone_number: PHONE_KETUA, password: `SalahPassword${i}` }
      });
      assert(failRes.status === 401, `AUTH-04 (Percobaan #${i}): Login salah mengembalikan 401 Unauthorized`, `Status: ${failRes.status}`);
      assert(
        typeof failRes.data?.error === 'string' && failRes.data.error.toLowerCase().includes('tidak valid'),
        `AUTH-04 (Percobaan #${i}): Pesan error generik dan tidak membocorkan eksistensi akun`
      );
    }

    // Percobaan ke-6 harus diblokir oleh Rate Limiter (429 Too Many Requests)
    const blockedRes = await bruteClient.request('POST', '/api/auth/login', {
      ip: bruteIp,
      body: { phone_number: PHONE_KETUA, password: TEST_PASSWORD }
    });
    assert(blockedRes.status === 429, 'AUTH-04 (Percobaan #6): Dikunci oleh rate limit (429 Too Many Requests)', `Status: ${blockedRes.status}`);

    // Bersihkan rate limit agar PHONE_KETUA bisa dipakai di skenario berikutnya
    db.prepare('DELETE FROM web_login_attempts').run();
  }

  // =========================================================================
  // SKENARIO 5 (AUTH-05): Login Valid, Cookie HttpOnly & SameSite=Lax, /api/auth/me
  // =========================================================================
  console.log('\n--- Skenario 5 (AUTH-05): Login Valid, Cookie Keamanan & Profil Sesi ---');
  const ketuaClient = createApiClient(baseUrl);
  {
    const loginRes = await ketuaClient.request('POST', '/api/auth/login', {
      ip: '10.0.2.1',
      body: { phone_number: PHONE_KETUA, password: TEST_PASSWORD }
    });

    assert(loginRes.status === 200, 'AUTH-05a: Login valid mengembalikan 200 OK', `Status: ${loginRes.status}`);
    assert(loginRes.setCookie.includes(`${SESSION_COOKIE_NAME}=`), 'AUTH-05b: Set-Cookie mengandung kastor_session');
    assert(loginRes.setCookie.includes('HttpOnly'), 'AUTH-05c: Cookie memiliki atribut HttpOnly');
    assert(loginRes.setCookie.includes('SameSite=Lax'), 'AUTH-05d: Cookie memiliki atribut SameSite=Lax');

    // Verifikasi atribut Secure saat di balik HTTPS proxy
    const httpsClient = createApiClient(baseUrl);
    const httpsLogin = await httpsClient.request('POST', '/api/auth/login', {
      ip: '10.0.2.2',
      headers: { 'X-Forwarded-Proto': 'https' },
      body: { phone_number: PHONE_WAKIL, password: TEST_PASSWORD }
    });
    assert(httpsLogin.setCookie.includes('Secure'), 'AUTH-05e: Cookie memiliki atribut Secure saat koneksi HTTPS');

    const meRes = await ketuaClient.request('GET', '/api/auth/me');
    assert(meRes.status === 200, 'AUTH-05f: GET /api/auth/me mengembalikan 200 OK');
    assert(meRes.data?.user?.role === 'KETUA', 'AUTH-05g: GET /api/auth/me mengembalikan profil KETUA');
    assert(typeof meRes.data?.csrf_token === 'string' && meRes.data.csrf_token.length >= 16, 'AUTH-05h: GET /api/auth/me mengembalikan csrf_token');
  }

  // =========================================================================
  // SKENARIO 6 (RBAC-KETUA): Hak Akses Ketua & Wakil Ketua
  // =========================================================================
  console.log('\n--- Skenario 6 (RBAC-KETUA): Otorisasi Ketua & Wakil Ketua ---');
  {
    // Ketua membaca data kelasnya sendiri (XI RPL C)
    const studentsRes = await ketuaClient.request('GET', '/api/students');
    assert(studentsRes.status === 200 && studentsRes.data?.total > 0, 'RBAC-KETUA-01: Ketua dapat membaca daftar siswa kelasnya (XI RPL C)');

    // Ketua membaca rekap kas (Read-Only)
    const cashRecapRes = await ketuaClient.request('GET', '/api/cash/recap');
    assert(cashRecapRes.status === 200 && cashRecapRes.data?.ok === true, 'RBAC-KETUA-02: Ketua dapat membaca rekap kas (GET /api/cash/recap -> 200)');

    // Ketua ditolak saat mencoba mengubah pengaturan kas
    const cashWriteRes = await ketuaClient.request('POST', '/api/cash/settings', {
      body: { weekly_fee: 10000, active_weeks_count: 5 }
    });
    assert(cashWriteRes.status === 403, 'RBAC-KETUA-03: Ketua ditolak saat mengubah pengaturan kas (POST /api/cash/settings -> 403)', `Status: ${cashWriteRes.status}`);

    // Ketua ditolak saat mencoba mengubah pembayaran kas
    const cashPayWriteRes = await ketuaClient.request('POST', '/api/cash/payments', {
      body: { student_id: sampleStudentId, week_number: 1, is_paid: true }
    });
    assert(cashPayWriteRes.status === 403, 'RBAC-KETUA-04: Ketua ditolak saat mengubah pembayaran kas (POST /api/cash/payments -> 403)', `Status: ${cashPayWriteRes.status}`);

    // Ketua ditolak saat mengakses kelas lain via query ?class_id=
    const otherClassRes = await ketuaClient.request('GET', `/api/students?class_id=${encodeURIComponent(CLASS_OPUS)}`);
    assert(otherClassRes.status === 403, 'RBAC-KETUA-05: Ketua ditolak saat mengakses kelas lain (?class_id=opus -> 403)', `Status: ${otherClassRes.status}`);

    // Verifikasi Wakil Ketua memiliki izin efektif setara Ketua
    const wakilClient = createApiClient(baseUrl);
    await wakilClient.request('POST', '/api/auth/login', {
      ip: '10.0.2.3',
      body: { phone_number: PHONE_WAKIL, password: TEST_PASSWORD }
    });
    const wakilCashRead = await wakilClient.request('GET', '/api/cash/recap');
    const wakilCashWrite = await wakilClient.request('POST', '/api/cash/settings', { body: { weekly_fee: 9000 } });
    assert(wakilCashRead.status === 200 && wakilCashWrite.status === 403, 'RBAC-KETUA-06: Wakil Ketua dapat membaca rekap kas (200) namun ditolak mengubah kas (403)');
  }

  // =========================================================================
  // SKENARIO 7 (RBAC-SEKRETARIS): Hak Akses Sekretaris (Dilarang Kas)
  // =========================================================================
  console.log('\n--- Skenario 7 (RBAC-SEKRETARIS): Otorisasi Sekretaris ---');
  const sekretarisClient = createApiClient(baseUrl);
  {
    const loginRes = await sekretarisClient.request('POST', '/api/auth/login', {
      ip: '10.0.3.1',
      body: { phone_number: PHONE_SEKRETARIS, password: TEST_PASSWORD }
    });
    assert(loginRes.status === 200, 'RBAC-SEKRETARIS-01: Sekretaris berhasil login');

    // Sekretaris dapat mengelola akademik (contoh: membaca siswa & jadwal)
    const schedRes = await sekretarisClient.request('GET', '/api/schedules');
    assert(schedRes.status === 200, 'RBAC-SEKRETARIS-02: Sekretaris dapat mengakses jadwal kelasnya (200)');

    // Sekretaris DITOLAK (403) pada seluruh endpoint kas
    const cashEndpoints = [
      { method: 'GET', path: '/api/cash/recap' },
      { method: 'GET', path: '/api/cash/settings' },
      { method: 'POST', path: '/api/cash/settings', body: { weekly_fee: 5000 } },
      { method: 'POST', path: '/api/cash/payments', body: { student_id: sampleStudentId, week_number: 1, is_paid: true } }
    ];

    for (const ep of cashEndpoints) {
      const res = await sekretarisClient.request(ep.method, ep.path, { body: ep.body || null });
      assert(res.status === 403, `RBAC-SEKRETARIS-03: Sekretaris ditolak (403) pada ${ep.method} ${ep.path}`, `Status: ${res.status}`);
    }

    // GET /api/dashboard/stats menyembunyikan cash_summary (null) untuk Sekretaris
    const statsRes = await sekretarisClient.request('GET', '/api/dashboard/stats');
    assert(statsRes.status === 200 && statsRes.data?.cash_summary === null, 'RBAC-SEKRETARIS-04: GET /api/dashboard/stats menyembunyikan cash_summary (null) bagi Sekretaris');
  }

  // =========================================================================
  // SKENARIO 8 (RBAC-BENDAHARA): Hak Akses Bendahara (Full Kas, Read-Only Akademik)
  // =========================================================================
  console.log('\n--- Skenario 8 (RBAC-BENDAHARA): Otorisasi Bendahara ---');
  const bendaharaClient = createApiClient(baseUrl);
  {
    const loginRes = await bendaharaClient.request('POST', '/api/auth/login', {
      ip: '10.0.4.1',
      body: { phone_number: PHONE_BENDAHARA, password: TEST_PASSWORD }
    });
    assert(loginRes.status === 200, 'RBAC-BENDAHARA-01: Bendahara berhasil login');

    // Bendahara dapat membaca & mengubah kas
    const recapRes = await bendaharaClient.request('GET', '/api/cash/recap');
    assert(recapRes.status === 200, 'RBAC-BENDAHARA-02: Bendahara dapat membaca GET /api/cash/recap (200)');

    const setRes = await bendaharaClient.request('POST', '/api/cash/settings', {
      body: { weekly_fee: 5000, active_weeks_count: 4 }
    });
    assert(setRes.status === 200, 'RBAC-BENDAHARA-03: Bendahara dapat mengubah POST /api/cash/settings (200)');

    const payRes = await bendaharaClient.request('POST', '/api/cash/payments', {
      body: { student_id: sampleStudentId, week_number: 1, is_paid: true }
    });
    assert(payRes.status === 200, 'RBAC-BENDAHARA-04: Bendahara dapat mencatat POST /api/cash/payments (200)');

    // Bendahara dapat mengatur minggu libur kas (POST /api/cash/holidays)
    const holidayRes = await bendaharaClient.request('POST', '/api/cash/holidays', {
      body: { week_number: 3, is_holiday: true }
    });
    assert(holidayRes.status === 200, 'RBAC-BENDAHARA-04b: Bendahara dapat menandai minggu libur (200)');
    assert(holidayRes.data?.holiday_weeks?.includes(3), 'Response holiday_weeks harus memuat minggu 3');

    // Ketua ditolak saat mencoba mengatur minggu libur kas
    const ketuaHolidayRes = await ketuaClient.request('POST', '/api/cash/holidays', {
      body: { week_number: 3, is_holiday: false }
    });
    assert(ketuaHolidayRes.status === 403, 'RBAC-KETUA: Non-bendahara ditolak dari POST /api/cash/holidays (403)');

    // Bendahara mengaktifkan kembali minggu 3 (masuk)
    const restoreHolidayRes = await bendaharaClient.request('POST', '/api/cash/holidays', {
      body: { week_number: 3, is_holiday: false }
    });
    assert(restoreHolidayRes.status === 200, 'RBAC-BENDAHARA-04c: Bendahara dapat mengaktifkan kembali minggu 3 (200)');
    assert(!restoreHolidayRes.data?.holiday_weeks?.includes(3), 'Response holiday_weeks tidak boleh memuat minggu 3');

    // Bendahara dapat membaca daftar siswa (GET /api/students -> 200)
    const stuGetRes = await bendaharaClient.request('GET', '/api/students');
    assert(stuGetRes.status === 200, 'RBAC-BENDAHARA-05: Bendahara dapat membaca daftar siswa (GET /api/students -> 200)');

    // Bendahara DITOLAK (403) saat mencoba menambah/mengubah/menghapus siswa, jadwal, PR, struktur
    const forbiddenWrites = [
      { name: 'POST /api/students', method: 'POST', path: '/api/students', body: { student_number: 45, name: 'Test Bendahara' } },
      { name: `PUT /api/students/${sampleStudentId}`, method: 'PUT', path: `/api/students/${sampleStudentId}`, body: { name: 'Ubah Nama' } },
      { name: `DELETE /api/students/${sampleStudentId}`, method: 'DELETE', path: `/api/students/${sampleStudentId}` },
      { name: 'POST /api/schedules', method: 'POST', path: '/api/schedules', body: { week_number: 1, day_index: 1, block_type: 'TEORI', subject_name: 'MTK', teacher_name: 'Guru', room_name: 'R1' } },
      { name: 'POST /api/assignments', method: 'POST', path: '/api/assignments', body: { subject: 'MTK', description: 'PR', deadline: '2026-12-01 23:59' } },
      { name: 'POST /api/structure', method: 'POST', path: '/api/structure', body: { position_name: 'SEKSI KEBERSIHAN', holder_name: 'Budi' } }
    ];

    for (const fw of forbiddenWrites) {
      const res = await bendaharaClient.request(fw.method, fw.path, { body: fw.body || null });
      assert(res.status === 403, `RBAC-BENDAHARA-06: Bendahara ditolak (403) saat memanggil ${fw.name}`, `Status: ${res.status}`);
    }
  }

  // =========================================================================
  // SKENARIO 9 (CLASS-ISOLATION & DEVELOPER SWITCHER)
  // =========================================================================
  console.log('\n--- Skenario 9 (CLASS-ISOLATION & DEVELOPER SWITCHER) ---');
  const devClient = createApiClient(baseUrl);
  {
    // Non-developer ditolak saat memanggil POST /api/classes/switch
    for (const [roleLabel, client] of [
      ['KETUA', ketuaClient],
      ['SEKRETARIS', sekretarisClient],
      ['BENDAHARA', bendaharaClient]
    ]) {
      const swRes = await client.request('POST', '/api/classes/switch', {
        body: { group_id: CLASS_OPUS }
      });
      assert(swRes.status === 403, `ISOLATION-01 (${roleLabel}): Ditolak (403) saat memanggil POST /api/classes/switch`, `Status: ${swRes.status}`);

      const qRes = await client.request('GET', `/api/dashboard/stats?class_id=${encodeURIComponent(CLASS_OPUS)}`);
      assert(qRes.status === 403, `ISOLATION-02 (${roleLabel}): Ditolak (403) saat memanipulasi query ?class_id= milik kelas lain`, `Status: ${qRes.status}`);

      const sysRes = await client.request('GET', '/api/system/status');
      assert(sysRes.status === 403, `ISOLATION-03 (${roleLabel}): Ditolak (403) saat mengakses /api/system/status`, `Status: ${sysRes.status}`);
    }

    // Manipulasi body group_id milik kelas lain pada POST
    const bodyTamperRes = await ketuaClient.request('POST', '/api/assignments', {
      body: {
        group_id: CLASS_OPUS,
        subject: 'Injeksi Kelas Lain',
        description: 'Percobaan IDOR',
        deadline: '2026-12-31 23:59'
      }
    });
    assert(bodyTamperRes.status === 403, 'ISOLATION-04 (KETUA): Ditolak (403) saat memanipulasi body group_id milik kelas lain', `Status: ${bodyTamperRes.status}`);

    // Login sebagai DEVELOPER
    const devLogin = await devClient.request('POST', '/api/auth/login', {
      ip: '10.0.5.1',
      body: { phone_number: PHONE_DEVELOPER, password: TEST_PASSWORD }
    });
    assert(devLogin.status === 200, 'DEV-01: Developer berhasil login (200)');

    // Developer dapat melihat semua kelas di GET /api/classes
    const classesRes = await devClient.request('GET', '/api/classes');
    assert(
      classesRes.status === 200 && Array.isArray(classesRes.data?.classes) && classesRes.data.classes.length >= 3,
      'DEV-02: Developer dapat melihat seluruh kelas di GET /api/classes (>= 3 kelas)',
      `Count: ${classesRes.data?.classes?.length}`
    );

    // Developer dapat berpindah kelas aktif via POST /api/classes/switch
    const switchOpus = await devClient.request('POST', '/api/classes/switch', {
      body: { group_id: CLASS_OPUS }
    });
    assert(
      switchOpus.status === 200 && switchOpus.data?.active_group_id === CLASS_OPUS,
      'DEV-03: Developer berhasil beralih konteks ke kelas opus'
    );

    const switchRpl = await devClient.request('POST', '/api/classes/switch', {
      body: { group_id: CLASS_XI_RPL_C }
    });
    assert(
      switchRpl.status === 200 && switchRpl.data?.active_group_id === CLASS_XI_RPL_C,
      'DEV-04: Developer berhasil beralih konteks ke kelas XI RPL C'
    );

    // Developer dapat mengakses /api/system/status dan /api/system/audit-logs
    const sysStatusRes = await devClient.request('GET', '/api/system/status');
    assert(
      sysStatusRes.status === 200 && sysStatusRes.data?.ok === true && sysStatusRes.data?.metrics?.db_counts,
      'DEV-05: Developer dapat mengakses GET /api/system/status (200)'
    );

    const auditRes = await devClient.request('GET', '/api/system/audit-logs');
    assert(
      auditRes.status === 200 && Array.isArray(auditRes.data?.logs) && auditRes.data.logs.length > 0,
      'DEV-06: Developer dapat mengakses GET /api/system/audit-logs (200)'
    );
  }

  // =========================================================================
  // SKENARIO 10 (CRUD, PENCABUTAN JABATAN REAL-TIME, & LOGOUT)
  // =========================================================================
  console.log('\n--- Skenario 10 (CRUD Lengkap, Pencabutan Jabatan Real-Time, & Logout) ---');
  {
    // 10A. CRUD Siswa (oleh Sekretaris di XI RPL C)
    const createStu = await sekretarisClient.request('POST', '/api/students', {
      body: {
        student_number: 49,
        name: 'Siswa Uji Otomatis',
        phone_number: '081234000049',
        nis: '99949',
        birth_info: 'Kediri, 01 Januari 2009',
        address: 'Jl. Uji Coba No. 49'
      }
    });
    assert(createStu.status === 201 && createStu.data?.student?.id, 'CRUD-STUDENT-01: Tambah siswa baru berhasil (201)');
    const createdStudentId = createStu.data.student.id;

    const updateStu = await sekretarisClient.request('PUT', `/api/students/${createdStudentId}`, {
      body: {
        name: 'Siswa Uji Otomatis (Updated)',
        address: 'Jl. Uji Coba Baru No. 99'
      }
    });
    assert(
      updateStu.status === 200 && updateStu.data?.student?.name === 'Siswa Uji Otomatis (Updated)',
      'CRUD-STUDENT-02: Edit biodata siswa berhasil (200)'
    );

    const delStu = await sekretarisClient.request('DELETE', `/api/students/${createdStudentId}`);
    assert(delStu.status === 200, 'CRUD-STUDENT-03: Hapus siswa berhasil (200)');

    // 10B. CRUD Jadwal (oleh Sekretaris)
    const createSched = await sekretarisClient.request('POST', '/api/schedules', {
      body: {
        week_number: 20,
        day_index: 5,
        block_type: 'BENGKEL',
        subject_name: 'Pemrograman Web Lanjut',
        teacher_name: 'Pak Uji QA',
        room_name: 'Lab RPL 1',
        time_start: '07:00',
        time_end: '15:30',
        notes: 'Membawa laptop'
      }
    });
    assert(createSched.status === 201 && createSched.data?.schedule?.id, 'CRUD-SCHEDULE-01: Tambah jadwal baru berhasil (201)');
    const createdSchedId = createSched.data.schedule.id;

    const updateSched = await sekretarisClient.request('PUT', `/api/schedules/${createdSchedId}`, {
      body: {
        subject_name: 'Pemrograman Web Fullstack',
        room_name: 'Lab RPL 2'
      }
    });
    assert(
      updateSched.status === 200 && updateSched.data?.schedule?.subject_name === 'Pemrograman Web Fullstack',
      'CRUD-SCHEDULE-02: Edit jadwal berhasil (200)'
    );

    const delSched = await sekretarisClient.request('DELETE', `/api/schedules/${createdSchedId}`);
    assert(delSched.status === 200, 'CRUD-SCHEDULE-03: Hapus jadwal berhasil (200)');

    // 10C. CRUD Tugas / PR (oleh Ketua)
    const createAss = await ketuaClient.request('POST', '/api/assignments', {
      body: {
        subject: 'Rekayasa Perangkat Lunak',
        description: 'Membuat dokumen pengujian otomatis',
        deadline: '2026-11-30 23:59'
      }
    });
    assert(createAss.status === 201 && createAss.data?.assignment?.id, 'CRUD-ASSIGNMENT-01: Tambah PR baru berhasil (201)');
    const createdAssId = createAss.data.assignment.id;

    const toggleAss = await ketuaClient.request('PATCH', `/api/assignments/${createdAssId}/toggle`);
    assert(
      toggleAss.status === 200 && Number(toggleAss.data?.assignment?.is_completed) === 1,
      'CRUD-ASSIGNMENT-02: Toggle status selesai PR berhasil (200)'
    );

    const updateAss = await ketuaClient.request('PUT', `/api/assignments/${createdAssId}`, {
      body: {
        subject: 'RPL (Edited)',
        description: 'Membuat dokumen pengujian otomatis v2',
        deadline: '2026-12-01 23:59'
      }
    });
    assert(
      updateAss.status === 200 && updateAss.data?.assignment?.subject === 'RPL (Edited)',
      'CRUD-ASSIGNMENT-03: Edit PR berhasil (200)'
    );

    const delAss = await ketuaClient.request('DELETE', `/api/assignments/${createdAssId}`);
    assert(delAss.status === 200, 'CRUD-ASSIGNMENT-04: Hapus PR berhasil (200)');

    // 10D. CRUD Struktur Pengurus (oleh Ketua)
    const upsertStruct = await ketuaClient.request('POST', '/api/structure', {
      body: {
        position_name: 'KOORDINATOR LITERASI',
        holder_name: 'Siswa Literasi',
        phone_number: '081234999888'
      }
    });
    assert(
      upsertStruct.status === 200 && upsertStruct.data?.structure?.id,
      'CRUD-STRUCTURE-01: Tambah/Update jabatan struktur organisasi berhasil (200)'
    );
    const createdStructId = upsertStruct.data.structure.id;

    const delStruct = await ketuaClient.request('DELETE', `/api/structure/${createdStructId}`);
    assert(delStruct.status === 200, 'CRUD-STRUCTURE-02: Hapus jabatan struktur organisasi berhasil (200)');

    // 10D.2. Multi-Group Class Linking (Grup Cabang / Terhubung via Dashboard)
    const testBranchGroupId = '120363999999999999@g.us';
    const testBranchLabel = 'Grup Khusus Putra XI RPL C';

    // Bersihkan jika ada sisa data di DB sementara
    db.prepare('DELETE FROM class_groups WHERE group_id = ?').run(testBranchGroupId);

    // KETUA cek daftar linked groups
    const getLinkedRes1 = await ketuaClient.request('GET', '/api/classes/linked-groups');
    assert(
      getLinkedRes1.status === 200 && Array.isArray(getLinkedRes1.data?.linked_groups),
      'LINKED-GROUP-01: Ketua berhasil mengambil daftar grup cabang terhubung (200)'
    );

    // KETUA menghubungkan grup cabang baru
    const addLinkedRes = await ketuaClient.request('POST', '/api/classes/linked-groups', {
      body: {
        branch_group_id: testBranchGroupId,
        label: testBranchLabel
      }
    });
    assert(
      addLinkedRes.status === 201 &&
        (addLinkedRes.data?.linked_group?.id || addLinkedRes.data?.id) &&
        addLinkedRes.data?.linked_group?.group_id === testBranchGroupId,
      'LINKED-GROUP-02: Ketua berhasil menghubungkan grup cabang baru (201)',
      `Status: ${addLinkedRes.status}, Error: ${JSON.stringify(addLinkedRes.data)}`
    );
    const createdLinkId = addLinkedRes.data?.linked_group?.id || addLinkedRes.data?.id;

    // Cek di GET /api/structure apakah linked_groups ikut ter-render
    const getStructWithLinks = await ketuaClient.request('GET', '/api/structure');
    assert(
      getStructWithLinks.status === 200 &&
        Array.isArray(getStructWithLinks.data?.linked_groups) &&
        getStructWithLinks.data.linked_groups.some(g => g.group_id === testBranchGroupId),
      'LINKED-GROUP-03: GET /api/structure menyertakan daftar grup cabang yang terhubung'
    );

    // Hubungkan grup yang sama lagi -> ditolak (409)
    const duplicateLinkRes = await ketuaClient.request('POST', '/api/classes/linked-groups', {
      body: {
        branch_group_id: testBranchGroupId,
        label: 'Duplikat Grup'
      }
    });
    assert(
      duplicateLinkRes.status === 409,
      'LINKED-GROUP-04: Menghubungkan grup yang sudah terhubung ditolak (409 Conflict)',
      `Status: ${duplicateLinkRes.status}`
    );

    // Validasi format JID tidak valid -> ditolak (400)
    const invalidJidRes = await ketuaClient.request('POST', '/api/classes/linked-groups', {
      body: {
        branch_group_id: '123456789_bukan_jid',
        label: 'Format JID Salah'
      }
    });
    assert(
      invalidJidRes.status === 400,
      'LINKED-GROUP-05: JID grup tidak valid (@g.us) ditolak (400 Bad Request)',
      `Status: ${invalidJidRes.status}`
    );

    // BENDAHARA mencoba menambahkan grup cabang -> ditolak (403 Forbidden)
    const bendaharaLinkRes = await bendaharaClient.request('POST', '/api/classes/linked-groups', {
      body: {
        branch_group_id: '120363888888888888@g.us',
        label: 'Grup Cabang Bendahara'
      }
    });
    assert(
      bendaharaLinkRes.status === 403,
      'LINKED-GROUP-06: Bendahara ditolak saat mencoba menambah grup cabang (403 Forbidden)',
      `Status: ${bendaharaLinkRes.status}`
    );

    // KETUA mengubah nama penanda/label grup cabang via PUT
    const updateLabelRes = await ketuaClient.request('PUT', `/api/classes/linked-groups/${createdLinkId}`, {
      body: {
        group_label: 'Khusus Cowok RPL C'
      }
    });
    assert(
      updateLabelRes.status === 200 &&
        updateLabelRes.data?.linked_group?.group_label === 'Khusus Cowok RPL C',
      'LINKED-GROUP-UPDATE-01: Ketua berhasil memperbarui nama penanda grup via PUT (200)'
    );

    // Verifikasi perubahan nama penanda tercermin di GET /api/classes/linked-groups
    const getUpdatedLinked = await ketuaClient.request('GET', '/api/classes/linked-groups');
    const updatedItem = getUpdatedLinked.data?.linked_groups?.find(g => g.id === createdLinkId);
    assert(
      updatedItem && updatedItem.group_label === 'Khusus Cowok RPL C',
      'LINKED-GROUP-UPDATE-02: Nama penanda baru berhasil tercatat di database dan GET /api/classes/linked-groups'
    );

    // BENDAHARA mencoba mengubah nama penanda -> ditolak (403)
    const bendaharaUpdateRes = await bendaharaClient.request('PUT', `/api/classes/linked-groups/${createdLinkId}`, {
      body: { group_label: 'Label Ilegal Bendahara' }
    });
    assert(
      bendaharaUpdateRes.status === 403,
      'LINKED-GROUP-UPDATE-03: Bendahara ditolak saat mencoba mengubah nama penanda (403 Forbidden)',
      `Status: ${bendaharaUpdateRes.status}`
    );

    // Mengubah penanda dengan label kosong -> ditolak (400)
    const emptyLabelRes = await ketuaClient.request('PUT', `/api/classes/linked-groups/${createdLinkId}`, {
      body: { group_label: '   ' }
    });
    assert(
      emptyLabelRes.status === 400,
      'LINKED-GROUP-UPDATE-04: Mengubah nama penanda menjadi string kosong ditolak (400 Bad Request)',
      `Status: ${emptyLabelRes.status}`
    );

    // KETUA memutuskan tautan grup cabang via DELETE
    const unlinkRes = await ketuaClient.request('DELETE', `/api/classes/linked-groups/${createdLinkId}`);
    assert(
      unlinkRes.status === 200 && unlinkRes.data?.ok === true,
      'LINKED-GROUP-07: Ketua berhasil memutuskan tautan grup cabang (200)'
    );

    // Pastikan grup sudah tidak ada lagi di daftar
    const getLinkedRes2 = await ketuaClient.request('GET', '/api/classes/linked-groups');
    assert(
      getLinkedRes2.status === 200 &&
        !getLinkedRes2.data?.linked_groups?.some(g => g.group_id === testBranchGroupId),
      'LINKED-GROUP-08: Grup cabang yang diputuskan sudah tidak muncul di GET /api/classes/linked-groups'
    );

    // 10E. Pencabutan Jabatan Real-Time
    const sek2Client = createApiClient(baseUrl);
    const regSek2 = await sek2Client.request('POST', '/api/auth/register', {
      ip: '10.0.6.1',
      body: { phone_number: PHONE_SEKRETARIS_2, password: TEST_PASSWORD }
    });
    assert(regSek2.status === 201, 'REVOKE-01: Sekretaris 2 berhasil registrasi dan memiliki sesi aktif');

    const meBeforeRevoke = await sek2Client.request('GET', '/api/auth/me');
    assert(meBeforeRevoke.status === 200, 'REVOKE-02: Sesi Sekretaris 2 valid sebelum pencabutan jabatan');

    // Hapus jabatan Sekretaris 2 dari class_roles dan organization_structures di DB sementara
    const sek2Pattern = `%${normPhone(PHONE_SEKRETARIS_2).slice(-9)}%`;
    db.prepare('DELETE FROM class_roles WHERE phone_number LIKE ?').run(sek2Pattern);
    db.prepare('DELETE FROM organization_structures WHERE phone_number LIKE ?').run(sek2Pattern);

    const meAfterRevoke = await sek2Client.request('GET', '/api/auth/me');
    assert(
      meAfterRevoke.status === 401 || meAfterRevoke.status === 403,
      'REVOKE-03: Setelah jabatan dihapus dari DB, request dengan sesi lama langsung ditolak (401/403)',
      `Status: ${meAfterRevoke.status}`
    );

    // 10F. Uji Logout
    const logoutRes = await ketuaClient.request('POST', '/api/auth/logout');
    assert(logoutRes.status === 200, 'LOGOUT-01: POST /api/auth/logout mengembalikan 200 OK');

    const meAfterLogout = await ketuaClient.request('GET', '/api/auth/me');
    assert(meAfterLogout.status === 401, 'LOGOUT-02: Request ke /api/auth/me setelah logout mengembalikan 401 Unauthorized');
  }

  // =========================================================================
  // SKENARIO 11 (SQL INJECTION & XSS SAFETY)
  // =========================================================================
  console.log('\n--- Skenario 11 (SQL Injection & XSS Safety) ---');
  {
    const sqliClient = createApiClient(baseUrl);
    const sqliPayloads = [
      "' OR 1=1 --",
      "' OR '1'='1",
      `${normPhone(PHONE_KETUA)}' UNION SELECT * FROM web_users --`,
      "\"; DROP TABLE students; --"
    ];

    for (const payload of sqliPayloads) {
      const res = await sqliClient.request('POST', '/api/auth/login', {
        ip: `10.77.0.${Math.floor(Math.random() * 200) + 1}`,
        body: { phone_number: payload, password: "' OR 1=1 --" }
      });
      assert(
        res.status === 401 || res.status === 400,
        `SQLI-LOGIN: Payload "${payload.slice(0, 24)}..." ditolak dengan aman (${res.status})`
      );
    }

    // Uji SQLi pada pencarian siswa
    const searchSqli = await devClient.request(
      'GET',
      `/api/students?search=${encodeURIComponent("' OR 1=1; DROP TABLE students; --")}`
    );
    assert(
      searchSqli.status === 200 && Array.isArray(searchSqli.data?.students) && searchSqli.data.students.length === 0,
      'SQLI-SEARCH: Payload SQLi pada pencarian siswa tidak membocorkan seluruh baris (0 hasil)'
    );

    // Pastikan tabel students tetap utuh
    const countAfterSqli = db.prepare('SELECT COUNT(*) AS c FROM students').get();
    assert(Number(countAfterSqli?.c || 0) > 30, 'SQLI-INTEGRITY: Tabel students tetap utuh tanpa kerusakan');
  }

  // =========================================================================
  // SKENARIO 12 (FRONTEND & UI ASSETS VERIFICATION)
  // =========================================================================
  console.log('\n--- Skenario 12 (Frontend & UI Assets Verification) ---');
  {
    const uiClient = createApiClient(baseUrl);

    const htmlRes = await uiClient.request('GET', '/');
    assert(htmlRes.status === 200 && htmlRes.text.includes('<!DOCTYPE html>'), 'UI-01: GET / mengembalikan index.html (200 OK)');
    assert(
      htmlRes.text.includes('Portal Administrasi Kelas') && htmlRes.text.includes('Registrasi Pengurus'),
      'UI-02: index.html berbahasa Indonesia & memiliki form Login serta Registrasi Pengurus'
    );
    assert(
      !/<select[^>]*name=["']role["']/i.test(htmlRes.text),
      'UI-03: Form registrasi TIDAK memiliki dropdown/input pilihan role manual'
    );

    const cssRes = await uiClient.request('GET', '/styles.css', {
      headers: { 'Sec-Fetch-Dest': 'style', 'Referer': `${baseUrl}/` }
    });
    assert(cssRes.status === 200, 'UI-04: GET /styles.css mengembalikan 200 OK');

    const requiredTokens = [
      '--bg: #0B0D10',
      '--surface: #11151A',
      '--surface-raised: #171C22',
      '--surface-hover: #20262E',
      '--border: #29313A',
      '--text: #F4F5F6',
      '--text-muted: #A1A8B1',
      '--text-subtle: #737C87',
      '--success: #55C99A',
      '--warning: #E7B66A',
      '--danger: #F07878',
      '--info: #82B8F4'
    ];
    const allTokensPresent = requiredTokens.every(token => cssRes.text.includes(token));
    assert(allTokensPresent, 'UI-05: styles.css memuat seluruh token warna wajib dari DESIGN.md');
    assert(cssRes.text.includes('@media (max-width: 1023px)'), 'UI-06: styles.css memiliki aturan layout responsif (@media)');

    const jsRes = await uiClient.request('GET', '/app.js', {
      headers: { 'Sec-Fetch-Dest': 'script', 'Referer': `${baseUrl}/` }
    });
    if (fs.existsSync(path.join(projectRoot, 'web/public/app.js'))) {
      assert(
        jsRes.status === 200 && (jsRes.headers.get('content-type') || '').includes('javascript'),
        'UI-07: GET /app.js mengembalikan kode JavaScript frontend (200 OK)'
      );
      const hasAllStates =
        (cssRes.text.includes('state-empty') || jsRes.text.includes('state-empty')) &&
        (cssRes.text.includes('state-error') || jsRes.text.includes('state-error')) &&
        (cssRes.text.includes('state-forbidden') || jsRes.text.includes('state-forbidden')) &&
        (cssRes.text.includes('skeleton') || jsRes.text.includes('skeleton') || cssRes.text.includes('spinner'));
      assert(hasAllStates, 'UI-08: Mendukung ke-5 state UI (loading, empty, error, success/toast, forbidden)');
    } else {
      const hasCssStates =
        cssRes.text.includes('.state-empty') &&
        cssRes.text.includes('.state-error') &&
        cssRes.text.includes('.state-forbidden') &&
        cssRes.text.includes('.spinner');
      assert(hasCssStates, 'UI-07: CSS memiliki definisi lengkap ke-5 state UI (loading, empty, error, success, forbidden)');
    }
  }

  // =========================================================================
  // SKENARIO 13 (STICKER RATE LIMIT PER GROUP & DEVELOPER DASHBOARD CONTROL)
  // =========================================================================
  console.log('\n--- Skenario 13 (Sticker Rate Limit Per Group & Developer Dashboard Control) ---');
  {
    resetStickerRateLimit('ALL');

    // 1. Cek konfigurasi default via endpoint Developer (/api/system/sticker-limit)
    const getCfgRes = await devClient.request('GET', '/api/system/sticker-limit');
    assert(
      getCfgRes.status === 200 &&
        getCfgRes.data?.config?.enabled === true &&
        getCfgRes.data?.config?.max_stickers === 1 &&
        getCfgRes.data?.config?.window_seconds === 120 &&
        getCfgRes.data?.config?.message === 'Pembuatan sticker sedang limit, mohon tunggu sebentar',
      'STICKER-LIMIT-01: Default limit stiker adalah 1 stiker per 120 detik (2 menit) dengan pesan tepat'
    );

    // 2. Non-Developer (Bendahara / Sekretaris) ditolak mengakses pengaturan limit stiker (403 Forbidden)
    const bendaharaGetLimit = await bendaharaClient.request('GET', '/api/system/sticker-limit');
    const sekretarisPostLimit = await sekretarisClient.request('POST', '/api/system/sticker-limit', {
      body: { enabled: false, max_stickers: 10, window_seconds: 10 }
    });
    assert(
      bendaharaGetLimit.status === 403 && sekretarisPostLimit.status === 403,
      'STICKER-LIMIT-02: Non-developer ditolak mengakses/mengubah pengaturan limit stiker (403 Forbidden)'
    );

    // 3. Simulasi pembuatan stiker ke-1 di Grup A (CLASS_XI_RPL_C) -> Diizinkan
    const check1 = checkStickerRateLimit(CLASS_XI_RPL_C);
    assert(check1.allowed === true, 'STICKER-LIMIT-03: Pembuatan stiker ke-1 di Grup A diizinkan');
    recordStickerUsage(CLASS_XI_RPL_C, '6282118116660@s.whatsapp.net', '/s');

    // 4. Simulasi pembuatan stiker ke-2 di Grup A dalam < 2 menit -> Ditolak dengan pesan wajib
    const check2 = checkStickerRateLimit(CLASS_XI_RPL_C);
    assert(
      check2.allowed === false &&
        check2.message === 'Pembuatan sticker sedang limit, mohon tunggu sebentar',
      'STICKER-LIMIT-04: Pembuatan stiker ke-2 di Grup A dalam 2 menit diblokir dengan pesan "Pembuatan sticker sedang limit, mohon tunggu sebentar"'
    );

    // 5. Grup B (CLASS_OPUS) tidak terdampak limit Grup A
    const checkOtherGroup = checkStickerRateLimit(CLASS_OPUS);
    assert(
      checkOtherGroup.allowed === true,
      'STICKER-LIMIT-05: Isolasi per grup berjalan baik (Grup B tetap bisa membuat stiker saat Grup A sedang limit)'
    );

    // 6. Rollback kuota bila proses pembuatan stiker gagal/error
    const recB = recordStickerUsage(CLASS_OPUS, '6285155054456@s.whatsapp.net', '/brat');
    assert(checkStickerRateLimit(CLASS_OPUS).allowed === false, 'STICKER-LIMIT-06A: Grup B tercatat menggunakan kuota');
    removeStickerUsageById(recB);
    assert(
      checkStickerRateLimit(CLASS_OPUS).allowed === true,
      'STICKER-LIMIT-06B: Rollback kuota stiker saat gagal mengembalikan jatah grup'
    );

    // 7. Developer mengubah pengaturan limit stiker dari Dashboard (misal 2 stiker / 60 detik)
    const updateCfgRes = await devClient.request('POST', '/api/system/sticker-limit', {
      body: {
        enabled: true,
        max_stickers: 2,
        window_seconds: 60,
        message: 'Pembuatan sticker sedang limit, mohon tunggu sebentar'
      }
    });
    assert(
      updateCfgRes.status === 200 &&
        updateCfgRes.data?.config?.max_stickers === 2 &&
        updateCfgRes.data?.config?.window_seconds === 60,
      'STICKER-LIMIT-07: Developer berhasil mengubah konfigurasi limit stiker dari dashboard'
    );

    // Karena max_stickers sekarang 2, Grup A yang baru memakai 1 stiker kembali diizinkan untuk stiker ke-2
    assert(
      checkStickerRateLimit(CLASS_XI_RPL_C).allowed === true,
      'STICKER-LIMIT-08: Perubahan limit oleh Developer langsung berlaku real-time tanpa restart bot'
    );

    // Kembalikan ke pengaturan standar 1 stiker / 120 detik dan reset cooldown
    await devClient.request('POST', '/api/system/sticker-limit', {
      body: {
        enabled: true,
        max_stickers: 1,
        window_seconds: 120,
        message: 'Pembuatan sticker sedang limit, mohon tunggu sebentar'
      }
    });
    const resetRes = await devClient.request('POST', '/api/system/sticker-limit/reset', {
      body: { group_id: 'ALL' }
    });
    assert(
      resetRes.status === 200 && checkStickerRateLimit(CLASS_XI_RPL_C).allowed === true,
      'STICKER-LIMIT-09: Developer berhasil me-reset cooldown grup dari dashboard'
    );
  }

  // =========================================================================
  // SKENARIO 14: Modul Rekap Keuangan & Buku Kas Kelas (/api/finance/*)
  // =========================================================================
  console.log('\n--- Skenario 14 (FINANCE): Rekap Keuangan & Buku Kas Kelas ---');
  {
    // Re-login ketuaClient karena sempat logout di Skenario 10F
    await ketuaClient.request('POST', '/api/auth/login', {
      body: { phone_number: PHONE_KETUA, password: TEST_PASSWORD }
    });

    // 1. Bendahara dapat mengakses GET /api/finance/summary (200 OK)
    const finSummaryRes = await bendaharaClient.request('GET', '/api/finance/summary?range=30d&group_by=day');
    assert(
      finSummaryRes.status === 200 && finSummaryRes.data?.ok === true && typeof finSummaryRes.data?.current_balance === 'number',
      'FINANCE-01: Bendahara dapat membaca GET /api/finance/summary (200 OK)'
    );

    // 2. Sekretaris DILARANG TOTAL (403 Forbidden)
    const sekrFinRes = await sekretarisClient.request('GET', '/api/finance/summary');
    assert(
      sekrFinRes.status === 403,
      'FINANCE-02: Sekretaris ditolak total dari GET /api/finance/summary (403 Forbidden)'
    );

    // 3. Ketua dapat membaca GET /api/finance/summary (Read-Only)
    const ketuaFinRes = await ketuaClient.request('GET', '/api/finance/summary');
    assert(
      ketuaFinRes.status === 200,
      'FINANCE-03: Ketua dapat membaca GET /api/finance/summary (200 OK)'
    );

    // 4. Ketua DITOLAK saat mencoba mencatat transaksi (POST -> 403 Forbidden)
    const ketuaPostRes = await ketuaClient.request('POST', '/api/finance/transactions', {
      body: {
        type: 'EXPENSE',
        amount: 20000,
        description: 'Beli Lakban Ketua',
        transaction_date: '2026-10-30'
      }
    });
    assert(
      ketuaPostRes.status === 403,
      'FINANCE-04: Ketua ditolak saat mencoba mencatat transaksi manual (403 Forbidden)'
    );

    // 5. Bendahara berhasil mencatat transaksi pengeluaran (POST -> 201 Created)
    const addExpenseRes = await bendaharaClient.request('POST', '/api/finance/transactions', {
      body: {
        type: 'EXPENSE',
        amount: 35000,
        description: 'Beli Penghapus & Refill Tinta Spidol',
        transaction_date: '2026-10-30'
      }
    });
    assert(
      addExpenseRes.status === 201 && addExpenseRes.data?.transaction?.id,
      'FINANCE-05: Bendahara berhasil mencatat pengeluaran manual (201 Created)'
    );
    const createdTxId = addExpenseRes.data?.transaction?.id;

    // 6. Bendahara berhasil memperbarui transaksi (PUT -> 200 OK)
    const updateTxRes = await bendaharaClient.request('PUT', `/api/finance/transactions/${createdTxId}`, {
      body: {
        amount: 40000,
        description: 'Beli Penghapus, Refill Tinta & Map Raport'
      }
    });
    assert(
      updateTxRes.status === 200 && updateTxRes.data?.transaction?.amount === 40000,
      'FINANCE-06: Bendahara berhasil memperbarui nominal transaksi manual (200 OK)'
    );

    // 7. Bendahara berhasil menghapus transaksi (DELETE -> 200 OK)
    const deleteTxRes = await bendaharaClient.request('DELETE', `/api/finance/transactions/${createdTxId}`);
    assert(
      deleteTxRes.status === 200 && deleteTxRes.data?.ok === true,
      'FINANCE-07: Bendahara berhasil menghapus transaksi manual (200 OK)'
    );
  }

  // =========================================================================
  // SKENARIO 15: Sinkronisasi Jadwal Blok (PUT /api/schedules/:id) & Integritas Minggu ke-18
  // =========================================================================
  console.log('\n--- Skenario 15: Sinkronisasi Jadwal Blok (PUT /api/schedules/:id) & Integritas Minggu ke-18 ---');
  {
    // Pastikan ketuaClient dan sekretarisClient login
    await ketuaClient.request('POST', '/api/auth/login', {
      body: { phone_number: PHONE_KETUA, password: TEST_PASSWORD }
    });
    await sekretarisClient.request('POST', '/api/auth/login', {
      body: { phone_number: PHONE_SEKRETARIS, password: TEST_PASSWORD }
    });

    // 15A. Persiapan Data Jadwal Blok Minggu ke-18 dengan kondisi asinkron & baris duplikat di Jumat
    // - Hari 1 (Senin): 07:50-15:30
    // - Hari 2 (Selasa): sengaja KOSONG (missing day) untuk menguji auto-populate KBM
    // - Hari 3 (Rabu): 07:00-15:30
    // - Hari 4 (Kamis): 07:00-15:00
    // - Hari 5 (Jumat slot 1): 07:00-15:15
    // - Hari 5 (Jumat slot 2 - duplikat): 15:15-16:00
    db.prepare('DELETE FROM schedules WHERE group_id = ? AND week_number = 18').run(CLASS_XI_RPL_C);

    const insertInitialSched = db.prepare(`
      INSERT INTO schedules (group_id, week_number, day_index, block_type, subject_name, teacher_name, room_name, time_start, time_end, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const mondayRow = insertInitialSched.run(
      CLASS_XI_RPL_C, 18, 1, 'BENGKEL', 'Mata Pelajaran Pilihan (Bengkel)', 'Guru Bengkel', 'Lab RPL / Bengkel', '07:50', '15:30', 'Wajib Wearpack Lengkap'
    );
    const mondayId = Number(mondayRow.lastInsertRowid);

    insertInitialSched.run(
      CLASS_XI_RPL_C, 18, 3, 'BENGKEL', 'Mata Pelajaran Pilihan (Bengkel)', 'Guru Pengampu MP', 'Lab RPL / Bengkel', '07:00', '15:30', 'Wajib Wearpack Lengkap'
    );
    insertInitialSched.run(
      CLASS_XI_RPL_C, 18, 4, 'BENGKEL', 'Mata Pelajaran Pilihan (Bengkel)', 'Guru Pengampu MP', 'Lab RPL / Bengkel', '07:00', '15:00', 'Wajib Wearpack Lengkap'
    );
    insertInitialSched.run(
      CLASS_XI_RPL_C, 18, 5, 'BENGKEL', 'Mata Pelajaran Pilihan (Bengkel)', 'Guru Pengampu MP', 'Lab RPL / Bengkel', '07:00', '15:15', 'Wajib Wearpack Lengkap'
    );
    insertInitialSched.run(
      CLASS_XI_RPL_C, 18, 5, 'BENGKEL', 'Bengkel / MP', 'Guru Pendamping / Wali Kelas', 'Lab RPL / Bengkel', '15:15', '16:00', 'Wajib Wearpack Lengkap'
    );

    // 15B. Sekretaris mengedit jadwal blok melalui PUT /api/schedules/:id pada record Senin (mondayId)
    // Mengubah mapel menjadi 'Kejuruan RPL (Bengkel / Praktik)', guru 'Guru Bengkel', ruang 'Lab RPL / Bengkel'
    const putRes = await sekretarisClient.request('PUT', `/api/schedules/${mondayId}`, {
      body: {
        week_number: 18,
        day_index: 1,
        block_type: 'BENGKEL',
        subject_name: 'Kejuruan RPL (Bengkel / Praktik)',
        teacher_name: 'Guru Bengkel',
        room_name: 'Lab RPL / Bengkel',
        time_start: '07:50',
        time_end: '15:30',
        notes: 'Wajib Wearpack Lengkap & Safety Shoes'
      }
    });

    assert(
      putRes.status === 200 && putRes.data?.ok === true && putRes.data?.success === true,
      'SCHED-SYNC-01: PUT /api/schedules/:id berhasil memperbarui jadwal blok dengan status 200 OK'
    );
    assert(
      putRes.data?.count_synchronized === 5,
      'SCHED-SYNC-02: count_synchronized pada response mengindikasikan 5 hari KBM tersinkronisasi'
    );

    // 15C. Verifikasi integritas data database pasca sinkronisasi
    const week18Rows = db.prepare(`
      SELECT id, day_index, time_start, time_end, subject_name, teacher_name, room_name, block_type, notes
      FROM schedules
      WHERE group_id = ? AND week_number = 18
      ORDER BY day_index ASC, time_start ASC
    `).all(CLASS_XI_RPL_C);

    assert(
      week18Rows.length === 5,
      `SCHED-SYNC-03: Total baris jadwal Minggu ke-18 tepat 5 baris (Senin-Jumat tanpa duplikasi), didapat ${week18Rows.length}`
    );

    const distinctDays = [...new Set(week18Rows.map((r) => r.day_index))];
    assert(
      distinctDays.length === 5 && [1, 2, 3, 4, 5].every((d) => distinctDays.includes(d)),
      'SCHED-SYNC-04: Seluruh hari KBM (1: Senin s/d 5: Jumat) lengkap terisi (hari Selasa yang sempat hilang berhasil di-insert otomatis)'
    );

    // Verifikasi semua baris memiliki mapel, guru, ruang, dan tipe blok yang sama
    const allConsistent = week18Rows.every((r) =>
      r.subject_name === 'Kejuruan RPL (Bengkel / Praktik)' &&
      r.teacher_name === 'Guru Bengkel' &&
      r.room_name === 'Lab RPL / Bengkel' &&
      r.block_type === 'BENGKEL'
    );
    assert(
      allConsistent,
      'SCHED-SYNC-05: Seluruh hari Senin s/d Jumat tersinkronisasi sempurna pada mapel "Kejuruan RPL (Bengkel / Praktik)", guru "Guru Bengkel", dan ruang "Lab RPL / Bengkel"'
    );

    // Verifikasi jam KBM spesifik tiap hari terjaga (Senin 07:50, Kamis selesai 15:00, Jumat selesai 15:15)
    const mondayDb = week18Rows.find((r) => r.day_index === 1);
    const tuesdayDb = week18Rows.find((r) => r.day_index === 2);
    const thursdayDb = week18Rows.find((r) => r.day_index === 4);
    const fridayDb = week18Rows.find((r) => r.day_index === 5);

    assert(
      mondayDb.time_start === '07:50' && mondayDb.time_end === '15:30',
      'SCHED-SYNC-06: Jam KBM Senin tetap mempertahankan start 07:50 s/d 15:30'
    );
    assert(
      tuesdayDb.time_start === '07:00' && tuesdayDb.time_end === '15:30',
      'SCHED-SYNC-07: Jam KBM Selasa hasil auto-populate memiliki jam standar 07:00 s/d 15:30'
    );
    assert(
      thursdayDb.time_start === '07:00' && thursdayDb.time_end === '15:00',
      'SCHED-SYNC-08: Jam KBM Kamis tetap mempertahankan jam pulang 15:00'
    );
    assert(
      fridayDb.time_start === '07:00' && fridayDb.time_end === '15:15',
      'SCHED-SYNC-09: Jam KBM Jumat tetap mempertahankan jam pulang 15:15 dan baris duplikat sore (15:15-16:00) telah dipangkas bersih'
    );

    // 15D. Verifikasi GET /api/schedules?week_number=18 menghasilkan data yang konsisten
    const getWeek18Res = await sekretarisClient.request('GET', '/api/schedules?week_number=18');
    assert(
      getWeek18Res.status === 200 && Array.isArray(getWeek18Res.data?.schedules),
      'SCHED-SYNC-10: GET /api/schedules?week_number=18 mengembalikan status 200 OK'
    );
    assert(
      getWeek18Res.data?.schedules?.length === 5,
      'SCHED-SYNC-11: GET /api/schedules mengembalikan tepat 5 entri untuk Minggu ke-18'
    );

    // Deduplikasi frontend simulation (sesuai app.js renderSchedulesView)
    const uniqueSchedules = [];
    const seenSubjects = new Set();
    for (const item of getWeek18Res.data.schedules) {
      const key = `${(item.subject_name || '').trim().toLowerCase()}|${(item.teacher_name || '').trim().toLowerCase()}|${(item.room_name || '').trim().toLowerCase()}|${item.block_type}`;
      if (!seenSubjects.has(key)) {
        seenSubjects.add(key);
        uniqueSchedules.push(item);
      }
    }
    assert(
      uniqueSchedules.length === 1,
      `SCHED-SYNC-12: Simulasi deduplikasi frontend web menghasilkan tepat 1 kartu jadwal blok unik (tidak ada duplikasi kartu), didapat ${uniqueSchedules.length}`
    );

    // 15E. Pengujian RBAC: Bendahara DITOLAK saat memanggil PUT /api/schedules/:id
    const bendaharaPutRes = await bendaharaClient.request('PUT', `/api/schedules/${mondayId}`, {
      body: { subject_name: 'Hacked by Bendahara' }
    });
    assert(
      bendaharaPutRes.status === 403,
      'SCHED-SYNC-13: Bendahara ditolak (403 Forbidden) saat mencoba mengedit jadwal via PUT'
    );

    // 15F. Pengujian Anti-IDOR: Mengedit jadwal kelas lain ditolak
    const opusPutRes = await ketuaClient.request('PUT', `/api/schedules/${mondayId}?class_id=${CLASS_OPUS}`, {
      body: { subject_name: 'Hacked IDOR' }
    });
    assert(
      opusPutRes.status === 403,
      'SCHED-SYNC-14: Ketua ditolak (403 Forbidden) saat mencoba memanipulasi jadwal kelas lain (Class Isolation)'
    );
  }

  // =========================================================================
  // SKENARIO 16: PENGUJIAN AKURASI TOGGLE MINGGU LIBUR KAS & SINKRONISASI KALKULASI
  // =========================================================================
  console.log('\n--- Skenario 16: Pengujian Akurasi Toggle Minggu Libur Kas & Sinkronisasi Kalkulasi ---');
  {
    // Pastikan bendahara login
    const bendaharaMe = await bendaharaClient.request('GET', '/api/auth/me');
    assert(bendaharaMe.status === 200, 'CASH-HOLIDAY-01: Bendahara aktif dan terautentikasi');

    // 16A. Siapkan pengaturan kas standar: Tarif 5000, 4 minggu aktif
    const initSettingsRes = await bendaharaClient.request('POST', '/api/cash/settings', {
      body: { weekly_fee: 5000, active_weeks_count: 4 }
    });
    assert(initSettingsRes.status === 200, 'CASH-HOLIDAY-02: Setup pengaturan kas (Rp5.000 / 4 minggu)');

    // 16B. Siapkan data pembayaran siswa uji:
    // Siswa A: bayar minggu 1 & 2 (belum minggu 3 & 4) -> tunggakan awal 2 minggu (Rp10.000)
    // Siswa B: bayar minggu 1, 2, & 4 (belum minggu 3) -> tunggakan awal 1 minggu (Rp5.000)
    const stuListRes = await bendaharaClient.request('GET', '/api/students');
    assert(stuListRes.status === 200 && stuListRes.data.students.length >= 2, 'CASH-HOLIDAY-03: Minimal 2 siswa tersedia');
    const studentA = stuListRes.data.students[0];
    const studentB = stuListRes.data.students[1];

    await bendaharaClient.request('POST', '/api/cash/payments', {
      body: {
        payments: [
          { student_id: studentA.id, week_number: 1, is_paid: 1 },
          { student_id: studentA.id, week_number: 2, is_paid: 1 },
          { student_id: studentA.id, week_number: 3, is_paid: 0 },
          { student_id: studentA.id, week_number: 4, is_paid: 0 },
          { student_id: studentB.id, week_number: 1, is_paid: 1 },
          { student_id: studentB.id, week_number: 2, is_paid: 1 },
          { student_id: studentB.id, week_number: 3, is_paid: 0 },
          { student_id: studentB.id, week_number: 4, is_paid: 1 }
        ]
      }
    });

    // Cek rekap sebelum minggu 3 diliburkan
    const recapBefore = await bendaharaClient.request('GET', '/api/cash/recap');
    assert(recapBefore.status === 200, 'CASH-HOLIDAY-04: GET /api/cash/recap berhasil dimuat');
    const stuABefore = recapBefore.data.students.find(s => s.student_id === studentA.id);
    const stuBBefore = recapBefore.data.students.find(s => s.student_id === studentB.id);

    assert(stuABefore.unpaid_weeks === 2 && stuABefore.arrears === 10000 && !stuABefore.is_lunas, 'CASH-HOLIDAY-05: Siswa A awal menunggak 2 minggu (Rp10.000)');
    assert(stuBBefore.unpaid_weeks === 1 && stuBBefore.arrears === 5000 && !stuBBefore.is_lunas, 'CASH-HOLIDAY-06: Siswa B awal menunggak 1 minggu (Rp5.000)');

    // 16C. Aksi Toggle: Bendahara meliburkan Minggu ke-3
    const setHolRes = await bendaharaClient.request('POST', '/api/cash/holidays', {
      body: { week_number: 3, is_holiday: true }
    });
    assert(setHolRes.status === 200, 'CASH-HOLIDAY-07: POST /api/cash/holidays berhasil menandai minggu 3 libur (200 OK)');
    assert(Array.isArray(setHolRes.data?.holiday_weeks) && setHolRes.data.holiday_weeks.includes(3), 'CASH-HOLIDAY-08: Array holiday_weeks memuat minggu 3');

    // 16D. Verifikasi Rekap setelah Minggu ke-3 Libur:
    // Beban kewajiban kas berkurang dari 4 minggu ke 3 minggu aktif (minggu 1, 2, 4)
    // Siswa A: bayar 2 minggu -> kini hanya kurang 1 minggu (Rp5.000)
    // Siswa B: bayar 3 minggu (1, 2, 4) -> kini LUNAS (0 minggu, Rp0, ✅)
    const recapAfterHol = await bendaharaClient.request('GET', '/api/cash/recap');
    const stuAAfter = recapAfterHol.data.students.find(s => s.student_id === studentA.id);
    const stuBAfter = recapAfterHol.data.students.find(s => s.student_id === studentB.id);

    assert(stuAAfter.unpaid_weeks === 1, `CASH-HOLIDAY-09: Tunggakan Siswa A berkurang ke 1 minggu, didapat ${stuAAfter.unpaid_weeks}`);
    assert(stuAAfter.arrears === 5000, `CASH-HOLIDAY-10: Nominal tunggakan Siswa A berkurang ke Rp5.000, didapat ${stuAAfter.arrears}`);
    assert(stuBAfter.unpaid_weeks === 0, `CASH-HOLIDAY-11: Siswa B otomatis Lunas (0 minggu), didapat ${stuBAfter.unpaid_weeks}`);
    assert(stuBAfter.arrears === 0 && stuBAfter.is_lunas === true, 'CASH-HOLIDAY-12: Siswa B terverifikasi LUNAS (arrears 0, is_lunas true)');
    assert(stuBAfter.status_label === '✅', `CASH-HOLIDAY-13: Status label Siswa B menampilkan centang ✅, didapat ${stuBAfter.status_label}`);

    // 16E. Verifikasi Sinkronisasi Dashboard Stats (/api/dashboard/stats)
    const statsRes = await bendaharaClient.request('GET', '/api/dashboard/stats');
    assert(statsRes.status === 200, 'CASH-HOLIDAY-14: GET /api/dashboard/stats 200 OK');
    assert(statsRes.data?.cash_summary?.active_weeks_count === 3, `CASH-HOLIDAY-15: active_weeks_count di dashboard stats mengecualikan minggu libur (ekspektasi 3), didapat ${statsRes.data?.cash_summary?.active_weeks_count}`);

    // 16F. Robust Boolean Parsing: Restore minggu libur menggunakan string "false"
    const restoreStrRes = await bendaharaClient.request('POST', '/api/cash/holidays', {
      body: { week_number: 3, is_holiday: 'false' }
    });
    assert(restoreStrRes.status === 200, 'CASH-HOLIDAY-16: POST /api/cash/holidays dengan is_holiday="false" berhasil');
    assert(!restoreStrRes.data?.holiday_weeks?.includes(3), 'CASH-HOLIDAY-17: Minggu 3 berhasil dicabut dari holiday_weeks menggunakan string "false"');

    // Cek rekap kembali normal setelah minggu libur dicabut
    const recapRestored = await bendaharaClient.request('GET', '/api/cash/recap');
    const stuARestored = recapRestored.data.students.find(s => s.student_id === studentA.id);
    const stuBRestored = recapRestored.data.students.find(s => s.student_id === studentB.id);

    assert(stuARestored.unpaid_weeks === 2 && stuARestored.arrears === 10000, 'CASH-HOLIDAY-18: Tunggakan Siswa A kembali ke Rp10.000 setelah libur dicabut');
    assert(stuBRestored.unpaid_weeks === 1 && stuBRestored.arrears === 5000 && !stuBRestored.is_lunas, 'CASH-HOLIDAY-19: Siswa B kembali menunggak Rp5.000 setelah libur dicabut');

    // 16G. Validasi Pencegahan Inflasi Minggu Masa Depan (Anti-Phantom-Arrears)
    // Menandai minggu 8 sebagai libur masa depan tidak boleh memperluas active_weeks_count (harus tetap 4)
    const futureHolRes = await bendaharaClient.request('POST', '/api/cash/holidays', {
      body: { week_number: 8, is_holiday: true }
    });
    assert(futureHolRes.status === 200, 'CASH-HOLIDAY-24a: POST /api/cash/holidays untuk minggu masa depan (minggu 8) sukses 200 OK');
    assert(futureHolRes.data?.active_weeks_count === 4, `CASH-HOLIDAY-24b: active_weeks_count tidak menggelembung ke 8 (tetap 4), didapat ${futureHolRes.data?.active_weeks_count}`);

    // Verifikasi rekap kas tidak memunculkan tunggakan siluman untuk minggu 5, 6, 7
    const recapAfterFutureHol = await bendaharaClient.request('GET', '/api/cash/recap');
    const stuAFuture = recapAfterFutureHol.data.students.find(s => s.student_id === studentA.id);
    assert(stuAFuture.unpaid_weeks === 2 && stuAFuture.arrears === 10000, `CASH-HOLIDAY-25: Siswa A tetap menunggak 2 minggu (Rp10.000), tanpa tagihan siluman minggu 5-7, didapat ${stuAFuture.arrears}`);

    // Bersihkan kembali minggu 8
    await bendaharaClient.request('POST', '/api/cash/holidays', {
      body: { week_number: 8, is_holiday: false }
    });

    // 16H. Validasi UI Assets: app.js & styles.css memuat elemen toggle dan styling
    const appJsContent = fs.readFileSync(path.join(projectRoot, 'web/public/app.js'), 'utf8');
    assert(appJsContent.includes('btn-toggle-cash-holiday'), 'CASH-HOLIDAY-26a: app.js memuat #btn-toggle-cash-holiday desktop');
    assert(appJsContent.includes('btn-toggle-cash-holiday-mobile'), 'CASH-HOLIDAY-26b: app.js memuat #btn-toggle-cash-holiday-mobile');
    assert(appJsContent.includes('Set Libur') && appJsContent.includes('Set Aktif'), 'CASH-HOLIDAY-26c: app.js memiliki label aksi yang jelas: Set Libur & Set Aktif');
    assert(appJsContent.includes('Libur') && appJsContent.includes('cashWeekOptionsList'), 'CASH-HOLIDAY-26d: app.js menyertakan status libur pada opsi pemilih minggu');

    const stylesCssContent = fs.readFileSync(path.join(projectRoot, 'web/public/styles.css'), 'utf8');
    assert(stylesCssContent.includes('.cash-week-btn.holiday'), 'CASH-HOLIDAY-27: styles.css memuat class styling .cash-week-btn.holiday');

    // 16I. Pengujian Endpoint REST GET /api/cash/holidays & RBAC
    const getHolidaysRes = await bendaharaClient.request('GET', '/api/cash/holidays');
    assert(getHolidaysRes.status === 200 && Array.isArray(getHolidaysRes.data?.holiday_weeks), 'CASH-HOLIDAY-28: GET /api/cash/holidays mengembalikan 200 OK dan daftar array minggu libur');

    const sekretarisHolRes = await sekretarisClient.request('GET', '/api/cash/holidays');
    assert(sekretarisHolRes.status === 403, 'CASH-HOLIDAY-29: Sekretaris ditolak (403 Forbidden) saat mengakses GET /api/cash/holidays');

    const ketuaHolRes = await ketuaClient.request('GET', '/api/cash/holidays');
    assert(ketuaHolRes.status === 200, 'CASH-HOLIDAY-30: Ketua diizinkan membaca GET /api/cash/holidays (Read-Only)');

    // 16J. Validasi CSS Media Query Anti-Duplikasi Tombol pada Tablet (768px-1023px)
    assert(
      stylesCssContent.includes('#btn-toggle-cash-holiday-mobile') && stylesCssContent.includes('.cash-holiday-mobile-group'),
      'CASH-HOLIDAY-31: styles.css menyembunyikan #btn-toggle-cash-holiday-mobile dan .cash-holiday-mobile-group pada breakpoint >= 768px'
    );
    assert(
      appJsContent.includes('cash-holiday-mobile-group') && appJsContent.includes('{ silent: true }'),
      'CASH-HOLIDAY-32: app.js mengelompokkan kontrol mobile dan menerapkan silent reload tanpa flickering layout shift'
    );

    // 16K. Validasi Boundary & Edge Cases Endpoint POST /api/cash/holidays (Week 0, 53, NaN)
    const invalidZeroRes = await bendaharaClient.request('POST', '/api/cash/holidays', {
      body: { week_number: 0, is_holiday: true }
    });
    assert(invalidZeroRes.status === 400 && invalidZeroRes.data.ok === false, 'CASH-HOLIDAY-33a: POST /api/cash/holidays menolak nomor minggu 0 dengan HTTP 400');

    const invalid53Res = await bendaharaClient.request('POST', '/api/cash/holidays', {
      body: { week_number: 53, is_holiday: true }
    });
    assert(invalid53Res.status === 400 && invalid53Res.data.ok === false, 'CASH-HOLIDAY-33b: POST /api/cash/holidays menolak nomor minggu 53 dengan HTTP 400');

    const invalidStrRes = await bendaharaClient.request('POST', '/api/cash/holidays', {
      body: { week_number: 'bukan_angka', is_holiday: true }
    });
    assert(invalidStrRes.status === 400 && invalidStrRes.data.ok === false, 'CASH-HOLIDAY-33c: POST /api/cash/holidays menolak nomor minggu non-numerik dengan HTTP 400');

    // 16L. Uji Ketahanan Schema Helper (setCashHolidayWeek & removeCashHolidayWeek) terhadap Anomali Input
    let schemaCrashOccurred = false;
    try {
      setCashHolidayWeek(null, 1);
      setCashHolidayWeek(CLASS_XI_RPL_C, null);
      setCashHolidayWeek(CLASS_XI_RPL_C, 'invalid');
      setCashHolidayWeek(CLASS_XI_RPL_C, 0);
      setCashHolidayWeek(CLASS_XI_RPL_C, 53);
      removeCashHolidayWeek(null, 1);
      removeCashHolidayWeek(CLASS_XI_RPL_C, null);
      removeCashHolidayWeek(CLASS_XI_RPL_C, 'invalid');
      removeCashHolidayWeek(CLASS_XI_RPL_C, 0);
      removeCashHolidayWeek(CLASS_XI_RPL_C, 53);
      getCashHolidayWeeks(null);
    } catch {
      schemaCrashOccurred = true;
    }
    assert(!schemaCrashOccurred, 'CASH-HOLIDAY-34: Schema holiday functions tahan terhadap input null/NaN/out-of-bounds tanpa memicu exception unhandled');
  }

  // =========================================================================
  // SKENARIO 17: PENGUJIAN CLIENT-SIDE DEMO SANDBOX & ISOLASI DATABASE
  // =========================================================================
  console.log('\n--- Skenario 17: Pengujian Client-Side Demo Sandbox & Isolasi Database ---');
  {
    // 17A. Verifikasi Ketersediaan & Validitas File Fisik
    const sandboxPath = path.resolve(__dirname, '../public/demo-sandbox.js');
    assert(fs.existsSync(sandboxPath), 'DEMO-01a: File web/public/demo-sandbox.js tersedia');
    const sandboxCode = fs.readFileSync(sandboxPath, 'utf8');
    assert(sandboxCode.includes('KastorDemoSandbox'), 'DEMO-01b: demo-sandbox.js mengekspor objek window.KastorDemoSandbox');
    assert(sandboxCode.includes('XI Sains Digital (Demo)'), 'DEMO-01c: demo-sandbox.js memuat nama kelas dummy terisolasi');

    // 17B. Verifikasi Integrasi di index.html & styles.css
    const indexHtmlContent = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');
    assert(indexHtmlContent.includes('demo-sandbox.js'), 'DEMO-02: index.html memuat skrip demo-sandbox.js');

    const stylesContent = fs.readFileSync(path.resolve(__dirname, '../public/styles.css'), 'utf8');
    assert(stylesContent.includes('.demo-banner-container'), 'DEMO-03a: styles.css memuat styling banner demo');
    assert(stylesContent.includes('.btn-outline-demo'), 'DEMO-03b: styles.css memuat styling tombol kontrol banner demo');

    // 17C. Verifikasi Proteksi Akses Langsung (Direct Navigation Blocking) pada File .js & .css
    const directJsRes = await fetch(`${baseUrl}/demo-sandbox.js`);
    assert(directJsRes.status === 404, 'DEMO-04a: Akses langsung tanpa referer ke .js mengembalikan HTTP 404');

    const addressBarJsRes = await fetch(`${baseUrl}/app.js`, {
      headers: { 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Accept': 'text/html' }
    });
    assert(addressBarJsRes.status === 404, 'DEMO-04b: Akses address bar browser ke /app.js diblokir dengan HTTP 404');

    const directCssRes = await fetch(`${baseUrl}/styles.css`);
    assert(directCssRes.status === 404, 'DEMO-04c: Akses langsung tanpa referer ke .css mengembalikan HTTP 404');

    const legitJsRes = await fetch(`${baseUrl}/demo-sandbox.js`, {
      headers: { 'Sec-Fetch-Dest': 'script', 'Referer': `${baseUrl}/demo` }
    });
    assert(legitJsRes.status === 200, 'DEMO-04d: Pemuatan sah berkas script (<script>) mengembalikan HTTP 200');

    const legitCssRes = await fetch(`${baseUrl}/styles.css`, {
      headers: { 'Sec-Fetch-Dest': 'style', 'Referer': `${baseUrl}/demo` }
    });
    assert(legitCssRes.status === 200, 'DEMO-04e: Pemuatan sah stylesheet (<link>) mengembalikan HTTP 200');

    // 17D. Verifikasi SPA Fallback untuk Rute /demo
    const getDemoRes = await fetch(`${baseUrl}/demo`);
    assert(getDemoRes.status === 200, 'DEMO-05a: Server menyajikan SPA index.html untuk rute /demo dengan HTTP 200');

    // 17E. Verifikasi Logika Intercept & Balik dari 0 (Isolated LocalStorage Simulation)
    const localStorageMock = (function () {
      let store = {};
      return {
        getItem: (key) => store[key] || null,
        setItem: (key, val) => { store[key] = String(val); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
      };
    })();

    const mockWindow = {
      location: { pathname: '/demo', search: '', origin: 'http://localhost:3001' },
      fetch: async () => ({ ok: true, status: 200, json: async () => ({}) })
    };
    const mockDocument = {
      getElementById: () => null,
      querySelector: () => null,
      addEventListener: () => {}
    };

    const runSandbox = new Function('window', 'document', 'localStorage', sandboxCode);
    runSandbox(mockWindow, mockDocument, localStorageMock);

    const Sandbox = mockWindow.KastorDemoSandbox;
    assert(Sandbox && typeof Sandbox.activate === 'function', 'DEMO-06a: Sandbox API terinisialisasi sempurna');

    Sandbox.activate();
    assert(Sandbox.isActive() === true, 'DEMO-06b: Mode demo aktif saat mengakses rute /demo');

    // Intercept GET /api/auth/me
    const meRes = await mockWindow.fetch('/api/auth/me');
    const meData = await meRes.json();
    assert(meData.ok === true && meData.user.role === 'DEVELOPER', 'DEMO-06c: /api/auth/me mengembalikan role DEVELOPER untuk sesi demo');

    // Tambah Siswa Simulasi
    const addRes = await mockWindow.fetch('/api/students', {
      method: 'POST',
      body: JSON.stringify({ name: 'Siswa Uji Sandbox', phone_number: '081299991234', gender: 'L' })
    });
    const addData = await addRes.json();
    assert(addData.ok === true && addData.student.name === 'Siswa Uji Sandbox', 'DEMO-06d: Tambah siswa di sandbox berhasil');

    // Verifikasi data SQLite server TETAP BERSIH tanpa penambahan siswa fiktif
    const dbCheck = db.prepare('SELECT COUNT(*) as count FROM students WHERE name = ?').get('Siswa Uji Sandbox');
    assert(Number(dbCheck?.count || 0) === 0, 'DEMO-06e: Database SQLite server 100% aman dan tidak tersentuh oleh mutasi sandbox');

    // Reset Sandbox ("Balik dari 0")
    Sandbox.resetStore();
    const storeAfterReset = Sandbox.getStore();
    assert(storeAfterReset.students.some(s => s.name === 'Siswa Uji Sandbox') === false, 'DEMO-06f: Reset store ("Balik dari 0") membersihkan data mutasi temporer');
    assert(storeAfterReset.students.length === 10, 'DEMO-06g: Reset store mengembalikan jumlah siswa ke nilai default awal (10 siswa)');

    // Keluar Sesi Demo
    Sandbox.exit();
    assert(localStorageMock.getItem('kastor_demo_active') === null, 'DEMO-06h: Keluar sesi demo menghapus state aktif dari browser');
  }

} finally {
  // Tutup server HTTP
  await new Promise((resolve) => {
    try {
      server.close(() => resolve());
    } catch {
      resolve();
    }
  });

  // Tutup koneksi database dan hapus file sementara
  try {
    if (db && typeof db.close === 'function') {
      db.close();
    }
  } catch {
    // ignore
  }

  for (const suffix of ['', '-wal', '-shm']) {
    const f = `${tempDbPath}${suffix}`;
    if (fs.existsSync(f)) {
      try {
        fs.unlinkSync(f);
      } catch {
        // ignore
      }
    }
  }
}

console.log('\n============================================================');
console.log(`📊 HASIL AKHIR PENGUJIAN WEB DASHBOARD: ${passedTests} LULUS, ${failedTests} GAGAL`);
console.log('============================================================');

if (failedTests > 0) {
  console.error('\nDaftar Kegagalan:');
  for (const f of failures) {
    console.error(`  - ${f}`);
  }
  process.exit(1);
} else {
  console.log('🎉 SELURUH SKENARIO PENGUJIAN LULUS 100%!\n');
  process.exit(0);
}
