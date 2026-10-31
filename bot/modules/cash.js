import { db, resolveClassGroupId } from '../../database/schema.js';
import * as xlsx from 'xlsx';
import { resolveLidToPhone, normalizeIndonesianPhone } from './assignments.js';

/**
 * Validasi apakah nomor pengirim adalah bendahara di kelas tertentu
 * @param {string} senderJid Format: 628xxxxxxxx@s.whatsapp.net
 * @returns {object|null} record class_roles atau null
 */
export function getTreasurerRole(senderJid) {
  // Format nomor: hilangkan suffix jika perlu atau cocokkan langsung
  const cleanJid = senderJid.replace(/:.*@/, '@');
  const exact = db.prepare(`
    SELECT cr.*, c.class_name 
    FROM class_roles cr
    JOIN classes c ON cr.group_id = c.group_id
    WHERE (cr.phone_number = ? OR cr.phone_number = ?) AND cr.role = 'BENDAHARA'
  `).get(cleanJid, senderJid);
  if (exact) return exact;

  // Cek kecocokan digit nomor telepon
  const digits = senderJid.split('@')[0].split(':')[0];
  if (digits && digits.length >= 9 && !digits.startsWith('123634')) {
    const byDigits = db.prepare(`
      SELECT cr.*, c.class_name 
      FROM class_roles cr
      JOIN classes c ON cr.group_id = c.group_id
      WHERE (cr.phone_number LIKE ? OR cr.phone_number LIKE ?) AND cr.role = 'BENDAHARA'
    `).get(`%${digits}%`, `%${digits.replace(/^62/, '0')}%`);
    if (byDigits) return byDigits;
  }

  return null;
}

/**
 * Daftarkan nomor WhatsApp sebagai Bendahara Kelas
 */
export function setClassTreasurer(groupId, targetJid, displayName = '') {
  groupId = resolveClassGroupId(groupId);
  const cleanJid = targetJid.replace(/:.*@/, '@');
  db.prepare(`
    INSERT INTO class_roles (group_id, phone_number, role)
    VALUES (?, ?, 'BENDAHARA')
    ON CONFLICT(group_id, phone_number, role) DO NOTHING
  `).run(groupId, cleanJid);

  const phoneNum = cleanJid.split('@')[0];
  const name = displayName || `@${phoneNum}`;
  db.prepare(`
    INSERT INTO organization_structures (group_id, position_name, holder_name)
    VALUES (?, 'BENDAHARA', ?)
    ON CONFLICT(group_id, position_name) DO UPDATE SET holder_name = excluded.holder_name
  `).run(groupId, name);

  return `✅ *Berhasil!* Nomor @${phoneNum} kini terdaftar sebagai *Bendahara Kelas*.\nSekarang bendahara dapat mengatur tarif kas dan mengirim rekapan kas via chat pribadi (PM) bot.`;
}

/**
 * Daftar seluruh bendahara kelas
 */
export function getClassTreasurers(groupId) {
  groupId = resolveClassGroupId(groupId);
  const treasurers = db.prepare(`
    SELECT phone_number FROM class_roles
    WHERE group_id = ? AND role = 'BENDAHARA'
  `).all(groupId);
  if (treasurers.length === 0) {
    return 'ℹ️ Belum ada Bendahara yang didaftarkan untuk kelas ini.\nAdmin Kelas dapat mendaftarkan dengan:\n`/bendahara set @tag` atau reply pesan calon bendahara dengan `/bendahara set`.';
  }
  let text = `💰 *DAFTAR BENDAHARA KELAS*\n────────────────────────────\n`;
  treasurers.forEach(t => {
    const num = t.phone_number.split('@')[0];
    text += `• @${num}\n`;
  });
  text += `\n💡 _Bendahara dapat mengirim rekapan kas via PM bot (teks ceklis atau file Excel)._`;
  return text;
}

/**
 * Hapus akses bendahara
 */
export function removeClassTreasurer(groupId, targetJid) {
  groupId = resolveClassGroupId(groupId);
  const cleanJid = targetJid.replace(/:.*@/, '@');
  db.prepare(`
    DELETE FROM class_roles
    WHERE group_id = ? AND phone_number = ? AND role = 'BENDAHARA'
  `).run(groupId, cleanJid);
  const num = cleanJid.split('@')[0];
  return `✅ Akses bendahara untuk @${num} berhasil dicabut.`;
}

/**
 * Mengatur tarif kas mingguan (PM Bendahara: /kas set [nominal])
 */
export function setWeeklyFee(groupId, nominal) {
  groupId = resolveClassGroupId(groupId);
  const fee = parseInt(nominal, 10);
  if (isNaN(fee) || fee <= 0) {
    return '⚠️ Nominal tidak valid. Contoh penggunaan: `/kas set 5000`';
  }

  db.prepare(`
    INSERT INTO cash_settings (group_id, weekly_fee, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(group_id) DO UPDATE SET weekly_fee = excluded.weekly_fee, updated_at = CURRENT_TIMESTAMP
  `).run(groupId, fee);

  return `✅ *Sukses!* Tarif kas mingguan berhasil diatur ke *Rp${fee.toLocaleString('id-ID')}*.`;
}

/**
 * Mengatur jumlah total minggu aktif kas
 */
export function setActiveWeeks(groupId, weeksCount) {
  const weeks = parseInt(weeksCount, 10);
  if (isNaN(weeks) || weeks <= 0) {
    return '⚠️ Jumlah minggu tidak valid.';
  }

  db.prepare(`
    UPDATE cash_settings SET active_weeks_count = ?, updated_at = CURRENT_TIMESTAMP
    WHERE group_id = ?
  `).run(weeks, groupId);

  return `✅ Total minggu aktif kas berhasil disetel ke *${weeks} minggu*.`;
}

/**
 * Parser Teks Ceklis Kas Bendahara (PM)
 * Format pesan:
 * KAS TANGGAL 29 JULI 2026 (MINGGU 2)
 * 1. naswa✅
 * 2. natasya✅
 * ...
 * 5. nikita
 */
export function parseChecklistText(groupId, text) {
  groupId = resolveClassGroupId(groupId);
  // 1. Ekstrak minggu ke-X
  const weekMatch = text.match(/MINGGU\s+(\d+)/i) || text.match(/PEKAN\s+(\d+)/i);
  let weekNumber = 1;
  if (weekMatch) {
    weekNumber = parseInt(weekMatch[1], 10);
  } else {
    // Ambil default dari cash_settings
    const cs = db.prepare('SELECT active_weeks_count FROM cash_settings WHERE group_id = ?').get(groupId);
    weekNumber = cs ? cs.active_weeks_count : 1;
  }

  // Update active_weeks_count jika weekNumber lebih besar
  db.prepare(`
    UPDATE cash_settings 
    SET active_weeks_count = MAX(active_weeks_count, ?), updated_at = CURRENT_TIMESTAMP
    WHERE group_id = ?
  `).run(weekNumber, groupId);

  const lines = text.split('\n');
  const students = db.prepare('SELECT id, student_number, name FROM students WHERE group_id = ?').all(groupId);
  const studentMapByNumber = new Map(students.map(s => [s.student_number, s]));

  let updatedCount = 0;
  let paidCount = 0;

  const insertOrUpdatePayment = db.prepare(`
    INSERT INTO cash_payments (group_id, student_id, week_number, is_paid, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(group_id, student_id, week_number) 
    DO UPDATE SET is_paid = excluded.is_paid, updated_at = CURRENT_TIMESTAMP
  `);

  for (const line of lines) {
    // Regex cari: [angka]. [nama] [opsional centang]
    const match = line.match(/^\s*(\d+)[\.\)]\s*(.*?)\s*$/);
    if (match) {
      const studentNum = parseInt(match[1], 10);
      const student = studentMapByNumber.get(studentNum);
      if (student) {
        const isPaid = /✅|v|centang/i.test(match[2]) ? 1 : 0;
        insertOrUpdatePayment.run(groupId, student.id, weekNumber, isPaid);
        updatedCount++;
        if (isPaid === 1) paidCount++;
      }
    }
  }

  if (updatedCount === 0) {
    return `⚠️ Tidak ditemukan baris nomor absen valid dalam teks ceklis.\nPastikan format: \`1. nama✅\` atau \`1. nama\`.`;
  }

  return `✅ *Rekap Ceklis Kas Disimpan!*\n` +
    `• Minggu ke: *${weekNumber}*\n` +
    `• Siswa terdata: *${updatedCount}*\n` +
    `• Lunas: *${paidCount}* siswa\n` +
    `• Belum: *${updatedCount - paidCount}* siswa`;
}

/**
 * Parser File Excel Kas Bendahara (PM)
 * Membaca buffer .xlsx, baris absen 1-36 dan kolom minggu yang terisi LUNAS
 */
export function parseExcelCash(groupId, buffer) {
  groupId = resolveClassGroupId(groupId);
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  if (!data || data.length === 0) {
    return '⚠️ File excel kosong atau tidak dapat dibaca.';
  }

  const students = db.prepare('SELECT id, student_number FROM students WHERE group_id = ?').all(groupId);
  const studentMapByNumber = new Map(students.map(s => [s.student_number, s]));

  // Cari baris header untuk menentukan kolom minggu (e.g., M1, Minggu 1, W1, dsb)
  let headerRowIndex = -1;
  const weekColumnMap = new Map(); // colIndex -> weekNumber

  for (let r = 0; r < Math.min(10, data.length); r++) {
    const row = data[r] || [];
    row.forEach((cell, cIdx) => {
      if (typeof cell === 'string') {
        const m = cell.match(/(?:minggu|m|pekan|w)\s*(\d+)/i);
        if (m) {
          weekColumnMap.set(cIdx, parseInt(m[1], 10));
          headerRowIndex = r;
        }
      }
    });
    if (weekColumnMap.size > 0) break;
  }

  if (weekColumnMap.size === 0) {
    return '⚠️ Tidak ditemukan kolom penanda minggu (contoh: "Minggu 1", "M1") pada file Excel.';
  }

  const insertOrUpdatePayment = db.prepare(`
    INSERT INTO cash_payments (group_id, student_id, week_number, is_paid, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(group_id, student_id, week_number) 
    DO UPDATE SET is_paid = excluded.is_paid, updated_at = CURRENT_TIMESTAMP
  `);

  let parsedCount = 0;
  let maxWeek = 1;

  for (let r = headerRowIndex + 1; r < data.length; r++) {
    const row = data[r] || [];
    // Deteksi nomor absen (biasanya di kolom 0 atau 1)
    let studentNum = null;
    for (let c = 0; c < 3; c++) {
      const val = parseInt(row[c], 10);
      if (!isNaN(val) && val >= 1 && val <= 36) {
        studentNum = val;
        break;
      }
    }

    if (studentNum && studentMapByNumber.has(studentNum)) {
      const student = studentMapByNumber.get(studentNum);
      weekColumnMap.forEach((wNum, colIdx) => {
        const cellVal = String(row[colIdx] || '').trim().toUpperCase();
        const isPaid = (cellVal === 'LUNAS' || cellVal === 'V' || cellVal === '1' || cellVal === 'TRUE' || cellVal.includes('✅')) ? 1 : 0;
        insertOrUpdatePayment.run(groupId, student.id, wNum, isPaid);
        parsedCount++;
        if (wNum > maxWeek) maxWeek = wNum;
      });
    }
  }

  // Update active_weeks_count
  db.prepare(`
    UPDATE cash_settings 
    SET active_weeks_count = MAX(active_weeks_count, ?), updated_at = CURRENT_TIMESTAMP
    WHERE group_id = ?
  `).run(maxWeek, groupId);

  return `✅ *Import Excel Sukses!*\nDiproses *${parsedCount}* entri status pembayaran hingga Minggu ke-${maxWeek}.`;
}

/**
 * Output Rekap Kas di Grup (/kas)
 * ATURAN FORMAT KETAT PRD:
 * - Siswa lunas: ✅
 * - Siswa menunggak: Nominal uang (contoh: Rp10.000) tanpa emoji peringatan.
 * - TIDAK MENAMPILKAN TOTAL TUNGGAKAN di akhir pesan.
 */
export function getCashRecap(groupId) {
  groupId = resolveClassGroupId(groupId);
  const classInfo = db.prepare('SELECT class_name FROM classes WHERE group_id = ?').get(groupId);
  if (!classInfo) return '⚠️ Kelas belum terdaftar di sistem bot.';

  const settings = db.prepare('SELECT weekly_fee, active_weeks_count FROM cash_settings WHERE group_id = ?').get(groupId);

  if (!settings || !settings.weekly_fee) {
    return `ℹ️ Tarif kas mingguan belum diatur untuk kelas ini.\nSilakan atur tarif terlebih dahulu menggunakan perintah:\n\`/kas set [nominal]\` (Contoh: \`/kas set 5000\`)`;
  }

  if (!settings.active_weeks_count || settings.active_weeks_count <= 0) {
    return `💰 *KAS KELAS ${classInfo.class_name.toUpperCase()}*\nTarif: Rp${settings.weekly_fee.toLocaleString('id-ID')}/minggu\n\nℹ️ Belum ada data minggu kas yang diinput oleh Bendahara.\nBendahara dapat mengirimkan teks ceklis atau file Excel rekapan kas via chat pribadi (PM).`;
  }

  const hasWeek1 = db.prepare('SELECT 1 FROM cash_payments WHERE group_id = ? AND week_number = 1 AND is_paid = 1 LIMIT 1').get(groupId);
  const startWeek = hasWeek1 ? 1 : 2;
  const maxWeek = Number(settings.active_weeks_count || 1);
  const totalWeeks = Math.max(0, maxWeek - startWeek + 1);

  const students = db.prepare(`
    SELECT s.id, s.student_number, s.name,
           COALESCE(SUM(CASE WHEN cp.is_paid = 1 AND cp.week_number >= ? AND cp.week_number <= ? THEN 1 ELSE 0 END), 0) AS paid_weeks
    FROM students s
    LEFT JOIN cash_payments cp ON s.id = cp.student_id AND cp.group_id = s.group_id
    WHERE s.group_id = ?
    GROUP BY s.id
    ORDER BY s.student_number ASC
  `).all(startWeek, maxWeek, groupId);

  if (students.length === 0) {
    return 'ℹ️ Belum ada data siswa di kelas ini.';
  }

  let text = `📊 *REKAP KAS KELAS ${classInfo.class_name.toUpperCase()}*\n\n`;

  const lines = students.map(s => {
    const unpaidWeeks = Math.max(0, totalWeeks - s.paid_weeks);

    if (unpaidWeeks === 0) {
      return `${s.student_number}. ${s.name}: ✅`;
    } else {
      const debt = unpaidWeeks * settings.weekly_fee;
      return `${s.student_number}. ${s.name}: Rp${debt.toLocaleString('id-ID')}`;
    }
  });

  text += lines.join('\n');
  return text;
}

/**
 * Output Cek Tagihan Kas Pribadi Siswa (/kas)
 * Menampilkan rincian status kas milik pengirim sendiri atau nomor absen tertentu.
 */
export function getStudentCashBill(groupId, senderJid, targetQuery = null) {
  groupId = resolveClassGroupId(groupId);
  const classInfo = db.prepare('SELECT class_name FROM classes WHERE group_id = ?').get(groupId);
  if (!classInfo) return '⚠️ Kelas belum terdaftar di sistem bot.';

  const settings = db.prepare('SELECT weekly_fee, active_weeks_count FROM cash_settings WHERE group_id = ?').get(groupId);
  if (!settings || !settings.weekly_fee) {
    return `ℹ️ Tarif kas mingguan belum diatur untuk kelas ini.\nSilakan atur tarif terlebih dahulu menggunakan perintah:\n\`/kas set [nominal]\` (Contoh: \`/kas set 5000\`)`;
  }

  let student = null;

  // Jika ada query khusus (misal: /kas 15 atau /kas Budi)
  if (targetQuery) {
    const q = targetQuery.trim();
    const num = parseInt(q, 10);
    if (!isNaN(num)) {
      student = db.prepare('SELECT * FROM students WHERE group_id = ? AND student_number = ?').get(groupId, num);
    }
    if (!student) {
      student = db.prepare('SELECT * FROM students WHERE group_id = ? AND name LIKE ?').get(groupId, `%${q}%`);
    }
  }

  // Jika tidak ada targetQuery atau tidak ditemukan via query, cari berdasarkan senderJid
  if (!student && senderJid) {
    let targetPhone = senderJid.replace(/:.*@/, '@');
    const senderDigits = targetPhone.split('@')[0];

    let resolvedPhone = null;
    if (targetPhone.endsWith('@lid')) {
      resolvedPhone = resolveLidToPhone(senderDigits);
    }

    const phoneVariants = [
      targetPhone,
      senderJid,
      resolvedPhone ? `${resolvedPhone}@s.whatsapp.net` : null,
      resolvedPhone,
      senderDigits
    ].filter(Boolean);

    for (const pv of phoneVariants) {
      const cleanDigits = normalizeIndonesianPhone(pv);
      student = db.prepare(`
        SELECT * FROM students 
        WHERE group_id = ? AND (
          phone_number = ? OR 
          phone_number LIKE ? OR
          phone_number LIKE ?
        )
      `).get(groupId, pv, `%${cleanDigits}%`, `%${pv}%`);
      if (student) break;
    }
  }

  if (!student) {
    return `⚠️ Nomor WhatsApp Anda belum terdaftar / terhubung dengan data siswa di kelas ini.\n` +
      `Hubungi Pengurus Kelas untuk menautkan nomor Anda pada master siswa dengan:\n` +
      `\`/siswa add [no_absen] [nama] @tag\`\n\n` +
      `💡 _Ketik \`/kas list\` untuk melihat daftar rekap kas seluruh siswa._`;
  }

  const hasWeek1 = db.prepare('SELECT 1 FROM cash_payments WHERE group_id = ? AND week_number = 1 AND is_paid = 1 LIMIT 1').get(groupId);
  const startWeek = hasWeek1 ? 1 : 2;
  const maxWeek = Number(settings.active_weeks_count || 1);
  const totalWeeks = Math.max(0, maxWeek - startWeek + 1);

  // Hitung pembayaran kas siswa
  const paymentRecord = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN is_paid = 1 AND week_number >= ? AND week_number <= ? THEN 1 ELSE 0 END), 0) AS paid_weeks
    FROM cash_payments
    WHERE group_id = ? AND student_id = ?
  `).get(startWeek, maxWeek, groupId, student.id);

  const paidWeeks = paymentRecord?.paid_weeks || 0;

  if (totalWeeks <= 0) {
    return `*TAGIHAN KAS SISWA*\n` +
      `────────────────────────────\n` +
      '```\n' +
      `Absen  : ${student.student_number}\n` +
      `Nama   : ${student.name}\n` +
      `Tarif  : Rp${settings.weekly_fee.toLocaleString('id-ID')}/minggu\n` +
      `Status : Belum ada tagihan minggu aktif\n` +
      '```\n' +
      `────────────────────────────\n` +
      `💡 _Ketik \`/kas list\` untuk melihat rekap kas seluruh kelas._`;
  }

  const unpaidWeeks = Math.max(0, totalWeeks - paidWeeks);

  if (unpaidWeeks === 0) {
    return `*TAGIHAN KAS SISWA*\n` +
      `────────────────────────────\n` +
      '```\n' +
      `Absen  : ${student.student_number}\n` +
      `Nama   : ${student.name}\n` +
      `Tarif  : Rp${settings.weekly_fee.toLocaleString('id-ID')}/minggu\n` +
      `Status : Lunas ✅\n` +
      '```\n' +
      `────────────────────────────\n` +
      `💡 _Ketik \`/kas list\` untuk melihat rekap kas seluruh kelas._`;
  } else {
    const debt = unpaidWeeks * settings.weekly_fee;
    return `*TAGIHAN KAS SISWA*\n` +
      `────────────────────────────\n` +
      '```\n' +
      `Absen  : ${student.student_number}\n` +
      `Nama   : ${student.name}\n` +
      `Tarif  : Rp${settings.weekly_fee.toLocaleString('id-ID')}/minggu\n` +
      `Kurang : ${unpaidWeeks} minggu\n` +
      `Tagihan: Rp${debt.toLocaleString('id-ID')}\n` +
      `Status : Belum Lunas\n` +
      '```\n' +
      `────────────────────────────\n` +
      `💡 _Silakan lakukan pembayaran ke Bendahara Kelas._\n` +
      `💡 _Ketik \`/kas list\` untuk melihat rekap kas seluruh kelas._`;
  }
}
