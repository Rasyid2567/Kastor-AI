/**
 * ============================================================================
 * KASTOR AI / ARAS 1.0 — TEST DATABASE SEEDER (ZERO DATA LEAK)
 * ============================================================================
 * Menginisialisasi database SQLite terisolasi dengan data dummy anonim untuk
 * keperluan Continuous Integration (CI) dan Automated Testing tanpa mengekspos
 * nomor WhatsApp riil atau data pribadi siswa.
 * ============================================================================
 */

import { initDatabase } from '../../database/schema.js';

export const TEST_CONSTANTS = {
  CLASS_XI_RPL_C: '120363401603280130@g.us',
  CLASS_OPUS: '120363429275295594@g.us',
  CLASS_PRIBADI: '120363403751366495@g.us',

  PHONE_UNKNOWN: '089999999999',
  PHONE_REGULAR_STUDENT: '081200000001', // Siswa biasa tanpa jabatan
  PHONE_KETUA: '081200000002',           // KETUA XI RPL C
  PHONE_WAKIL: '081200000003',           // WAKIL XI RPL C
  PHONE_SEKRETARIS: '081200000004',      // SEKRETARIS XI RPL C
  PHONE_SEKRETARIS_2: '081200000005',    // SEKRETARIS 2 XI RPL C
  PHONE_BENDAHARA: '081200000006',       // BENDAHARA XI RPL C
  PHONE_DEVELOPER: '6285155054456',      // DEVELOPER_NUMBER

  TEST_PASSWORD: 'PasswordAman#2026'
};

export function seedTestDatabase(db) {
  initDatabase();

  // Bersihkan tabel sesi dan auth sebelum uji
  try {
    db.prepare('DELETE FROM web_sessions').run();
    db.prepare('DELETE FROM web_users').run();
    db.prepare('DELETE FROM web_login_attempts').run();
    db.prepare('DELETE FROM web_audit_logs').run();
  } catch {}

  // 1. Inisialisasi Kelas
  const insertClass = db.prepare(`
    INSERT OR REPLACE INTO classes (group_id, class_name, academic_year, semester_start_date)
    VALUES (?, ?, ?, ?)
  `);
  insertClass.run(TEST_CONSTANTS.CLASS_XI_RPL_C, 'XI RPL C', '2026/2027', '2026-07-13');
  insertClass.run(TEST_CONSTANTS.CLASS_OPUS, 'KELAS OPUS', '2026/2027', '2026-07-13');
  insertClass.run(TEST_CONSTANTS.CLASS_PRIBADI, 'KELAS PRIBADI', '2026/2027', '2026-07-13');

  // 2. Inisialisasi Siswa Kelas XI RPL C
  const insertStudent = db.prepare(`
    INSERT OR REPLACE INTO students (group_id, student_number, name, phone_number, nis, birth_info, address, parent_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const studentList = [
    { num: 1, name: 'Siswa Satu (Regular)', phone: '6281200000001@s.whatsapp.net', nis: '24001', birth: 'Blitar, 1 Jan 2009', addr: 'Jl. Melati No. 1', parent: 'Ortu Satu' },
    { num: 2, name: 'Siswa Dua (Ketua)', phone: '6281200000002@s.whatsapp.net', nis: '24002', birth: 'Blitar, 2 Feb 2009', addr: 'Jl. Melati No. 2', parent: 'Ortu Dua' },
    { num: 3, name: 'Siswa Tiga (Wakil)', phone: '6281200000003@s.whatsapp.net', nis: '24003', birth: 'Blitar, 3 Mar 2009', addr: 'Jl. Melati No. 3', parent: 'Ortu Tiga' },
    { num: 4, name: 'Siswa Empat (Sekretaris)', phone: '6281200000004@s.whatsapp.net', nis: '24004', birth: 'Blitar, 4 Apr 2009', addr: 'Jl. Melati No. 4', parent: 'Ortu Empat' },
    { num: 5, name: 'Siswa Lima (Sekretaris 2)', phone: '6281200000005@s.whatsapp.net', nis: '24005', birth: 'Blitar, 5 Mei 2009', addr: 'Jl. Melati No. 5', parent: 'Ortu Lima' },
    { num: 6, name: 'Siswa Enam (Bendahara)', phone: '6281200000006@s.whatsapp.net', nis: '24006', birth: 'Blitar, 6 Jun 2009', addr: 'Jl. Melati No. 6', parent: 'Ortu Enam' }
  ];

  for (let i = 7; i <= 36; i++) {
    studentList.push({
      num: i,
      name: `Siswa ${i}`,
      phone: `62812000000${i.toString().padStart(2, '0')}@s.whatsapp.net`,
      nis: `240${i.toString().padStart(2, '0')}`,
      birth: 'Blitar, 10 Okt 2009',
      addr: `Jl. Siswa No. ${i}`,
      parent: `Ortu Siswa ${i}`
    });
  }

  for (const s of studentList) {
    insertStudent.run(TEST_CONSTANTS.CLASS_XI_RPL_C, s.num, s.name, s.phone, s.nis, s.birth, s.addr, s.parent);
  }

  // Siswa pada kelas lain (untuk uji isolasi IDOR)
  insertStudent.run(TEST_CONSTANTS.CLASS_OPUS, 1, 'Siswa Opus Satu', '6289900000001@s.whatsapp.net', '25001', 'Malang', 'Jl. Opus', 'Ortu Opus');

  // 3. Hak Akses / Role Siswa di class_roles
  const insertRole = db.prepare(`
    INSERT OR REPLACE INTO class_roles (group_id, phone_number, role)
    VALUES (?, ?, ?)
  `);
  insertRole.run(TEST_CONSTANTS.CLASS_XI_RPL_C, '6281200000002@s.whatsapp.net', 'KETUA');
  insertRole.run(TEST_CONSTANTS.CLASS_XI_RPL_C, '6281200000004@s.whatsapp.net', 'SEKRETARIS');
  insertRole.run(TEST_CONSTANTS.CLASS_XI_RPL_C, '6281200000005@s.whatsapp.net', 'SEKRETARIS');
  insertRole.run(TEST_CONSTANTS.CLASS_XI_RPL_C, '6281200000006@s.whatsapp.net', 'BENDAHARA');

  // 4. Struktur Organisasi Kelas (organization_structures)
  const insertStruct = db.prepare(`
    INSERT OR REPLACE INTO organization_structures (group_id, position_name, holder_name, phone_number)
    VALUES (?, ?, ?, ?)
  `);
  insertStruct.run(TEST_CONSTANTS.CLASS_XI_RPL_C, 'WAKIL KETUA', 'Siswa Tiga (Wakil)', '6281200000003@s.whatsapp.net');
  insertStruct.run(TEST_CONSTANTS.CLASS_XI_RPL_C, 'SEKRETARIS 1', 'Siswa Empat (Sekretaris)', '6281200000004@s.whatsapp.net');

  // 5. Pengaturan Kas (cash_settings)
  const insertCashSettings = db.prepare(`
    INSERT OR REPLACE INTO cash_settings (group_id, weekly_fee, active_weeks_count)
    VALUES (?, ?, ?)
  `);
  insertCashSettings.run(TEST_CONSTANTS.CLASS_XI_RPL_C, 5000, 3);
  insertCashSettings.run(TEST_CONSTANTS.CLASS_OPUS, 5000, 2);

  // 6. Data Jadwal Pelajaran (schedules)
  const insertSched = db.prepare(`
    INSERT OR REPLACE INTO schedules (group_id, week_number, day_index, block_type, subject_name, teacher_name, room_name, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertSched.run(TEST_CONSTANTS.CLASS_XI_RPL_C, 1, 1, 'TEORI', 'Pemrograman Web', 'Bpk. Guru Web', 'Lab RPL 1', 'Membawa laptop');
  insertSched.run(TEST_CONSTANTS.CLASS_XI_RPL_C, 1, 2, 'BENGKEL', 'Basis Data', 'Ibu Guru DB', 'Lab RPL 2', 'Praktik SQL');

  // 7. Pengaturan Bot & Limit Stiker
  db.prepare("INSERT OR REPLACE INTO bot_settings (key, value) VALUES ('sticker_limit_window_seconds', '120')").run();
  db.prepare("INSERT OR REPLACE INTO bot_settings (key, value) VALUES ('sticker_limit_count', '1')").run();
  db.prepare("INSERT OR REPLACE INTO bot_settings (key, value) VALUES ('sticker_limit_enabled', '1')").run();
}
