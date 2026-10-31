import { db, initDatabase } from './schema.js';

export function seedDefaultClass(targetGroupId = '120363000000000001@g.us') {
  initDatabase();

  const insertClass = db.prepare(`
    INSERT OR REPLACE INTO classes (group_id, class_name, academic_year, semester_start_date)
    VALUES (?, ?, ?, ?)
  `);
  insertClass.run(targetGroupId, 'XI RPL C', '2026/2027', '2026-07-13');

  // 1. Data 36 Siswa (Sesuai contoh di PRD: Naswa, Natasya, Nia Felly, Nicko, Nikita, Noviesca, ..., Rasyid, ..., Zakaria)
  const studentNames = [
    'Naswa', 'Natasya', 'Nia Felly', 'Nicko', 'Nikita', 'Noviesca',
    'Aditya Pratama', 'Ahmad Fauzi', 'Alifian Rizky', 'Anisa Rahmawati',
    'Arya Saputra', 'Bagus Ramadhan', 'Bayu Setiawan', 'Citra Dewi',
    'Rasyid', 'Dimas Anggara', 'Fahmi Idris', 'Farhan Maulana',
    'Fina Agustina', 'Gilang Ramadhan', 'Hendra Gunawan', 'Indra Lesmana',
    'Joko Susilo', 'Kevin Sanjaya', 'Lestari Putri', 'M. Rizky Pratama',
    'Nanda Pratiwi', 'Putra Pamungkas', 'Reza Rahardian', 'Rian Hidayat',
    'Riko Simanjuntak', 'Siti Nurhaliza', 'Teguh Prasetyo', 'Wahyu Hidayat',
    'Yusuf Mansur', 'Zakaria'
  ];

  const insertStudent = db.prepare(`
    INSERT OR REPLACE INTO students (group_id, student_number, name, phone_number)
    VALUES (?, ?, ?, ?)
  `);

  studentNames.forEach((name, idx) => {
    insertStudent.run(targetGroupId, idx + 1, name, `62810000000${(idx + 1).toString().padStart(2, '0')}@s.whatsapp.net`);
  });

  // 2. Default Roles
  const insertRole = db.prepare(`
    INSERT OR REPLACE INTO class_roles (group_id, phone_number, role)
    VALUES (?, ?, ?)
  `);
  // Contoh nomor bendahara (Naswa) & Ketua Kelas (Nicko)
  insertRole.run(targetGroupId, '6281000000001@s.whatsapp.net', 'BENDAHARA');
  insertRole.run(targetGroupId, '6281000000004@s.whatsapp.net', 'KETUA');

  // 3. Cash Settings
  const insertCashSetting = db.prepare(`
    INSERT OR REPLACE INTO cash_settings (group_id, weekly_fee, active_weeks_count)
    VALUES (?, ?, ?)
  `);
  insertCashSetting.run(targetGroupId, 5000, 3); // Default 3 minggu aktif berjalan

  // 4. Seeder Pembayaran Kas Contoh (Sesuai contoh PRD)
  const students = db.prepare('SELECT id, student_number FROM students WHERE group_id = ?').all(targetGroupId);
  const insertPayment = db.prepare(`
    INSERT OR REPLACE INTO cash_payments (group_id, student_id, week_number, is_paid)
    VALUES (?, ?, ?, ?)
  `);

  students.forEach(s => {
    // Siswa no 5 (Nikita) & 6 (Noviesca) nunggak 2 minggu (baru bayar minggu 1)
    // Siswa 36 (Zakaria) nunggak 1 minggu (bayar minggu 1 & 2)
    // Lainnya lunas 3 minggu
    if (s.student_number === 5 || s.student_number === 6) {
      insertPayment.run(targetGroupId, s.id, 1, 1);
      insertPayment.run(targetGroupId, s.id, 2, 0);
      insertPayment.run(targetGroupId, s.id, 3, 0);
    } else if (s.student_number === 36) {
      insertPayment.run(targetGroupId, s.id, 1, 1);
      insertPayment.run(targetGroupId, s.id, 2, 1);
      insertPayment.run(targetGroupId, s.id, 3, 0);
    } else {
      insertPayment.run(targetGroupId, s.id, 1, 1);
      insertPayment.run(targetGroupId, s.id, 2, 1);
      insertPayment.run(targetGroupId, s.id, 3, 1);
    }
  });

  // 5. Seeder Jadwal Blok (Minggu 1-20: Ganjil = TEORI, Genap = BENGKEL)
  const insertSchedule = db.prepare(`
    INSERT INTO schedules (group_id, week_number, day_index, block_type, subject_name, teacher_name, room_name, time_start, time_end, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Buat template jadwal untuk 20 minggu
  for (let week = 1; week <= 20; week++) {
    const isTeori = (week % 2 !== 0);
    const blockType = isTeori ? 'TEORI' : 'BENGKEL';

    if (isTeori) {
      // 5 Hari KBM Teori
      insertSchedule.run(targetGroupId, week, 1, blockType, 'Pendidikan Pancasila & Kewarganegaraan', 'Dra. Hj. Siti Aminah, M.Pd.', 'R.2 (Lantai 2)', '07:00', '15:30', 'Buku paket & catatan');
      insertSchedule.run(targetGroupId, week, 2, blockType, 'Bahasa Indonesia', 'Budi Santoso, S.Pd., M.Hum.', 'R.2 (Lantai 2)', '07:00', '15:30', 'Tugas naskah pidato');
      insertSchedule.run(targetGroupId, week, 3, blockType, 'Matematika Terapan', 'Dr. Ir. Hendra Setiawan, M.T.', 'R.2 (Lantai 2)', '07:00', '15:30', 'Membawa kalkulator saintifik');
      insertSchedule.run(targetGroupId, week, 4, blockType, 'Bahasa Inggris Kejuruan', 'Nurul Hidayati, S.S., M.Pd.', 'R.2 (Lantai 2)', '07:00', '15:30', 'Listening session');
      insertSchedule.run(targetGroupId, week, 5, blockType, 'Pendidikan Agama & Budi Pekerti', 'Ust. Ahmad Dahlan, S.Ag.', 'R.2 (Lantai 2)', '07:00', '15:30', 'Pakaian muslim/rapi');
    } else {
      // 5 Hari KBM Bengkel / Praktik
      insertSchedule.run(targetGroupId, week, 1, blockType, 'Pemrograman Web & Perangkat Bergerak', 'Agus Supriyanto, S.Kom., M.Kom.', 'Lab RPL 1', '07:00', '15:30', 'Wajib Wearpack Lengkap & Laptop');
      insertSchedule.run(targetGroupId, week, 2, blockType, 'Basis Data & SQL Lanjutan', 'Agus Supriyanto, S.Kom., M.Kom.', 'Lab RPL 1', '07:00', '15:30', 'Wajib Wearpack Lengkap');
      insertSchedule.run(targetGroupId, week, 3, blockType, 'Pemodelan Perangkat Lunak (UML)', 'Rina Wijayanti, S.T., M.Cs.', 'Lab RPL 2', '07:00', '15:30', 'Wajib Wearpack Lengkap');
      insertSchedule.run(targetGroupId, week, 4, blockType, 'Pemrograman Berorientasi Objek', 'Rina Wijayanti, S.T., M.Cs.', 'Lab RPL 2', '07:00', '15:30', 'Wajib Wearpack Lengkap');
      insertSchedule.run(targetGroupId, week, 5, blockType, 'Produk Kreatif & Kewirausahaan (PKK)', 'Drs. Tri Wahyudi, M.M.', 'Bengkel Kreatif', '07:00', '15:30', 'Wajib Wearpack Lengkap');
    }
  }

  // 6. Seeder Assignment Contoh
  const insertAssignment = db.prepare(`
    INSERT INTO assignments (group_id, subject, description, deadline, created_by, is_completed)
    VALUES (?, ?, ?, datetime('now', '+1 day'), ?, 0)
  `);
  insertAssignment.run(targetGroupId, 'Pemrograman Web', 'Membuat landing page responsive dengan CSS Grid', 'Nicko (Ketua)');

  console.log(`[SEEDER] Berhasil inisialisasi data kelas ${targetGroupId} (36 siswa, jadwal 20 minggu, kas, PR)!`);
}

// Jalankan jika dipanggil langsung
if (process.argv[1]?.endsWith('seed.js')) {
  seedDefaultClass();
}
