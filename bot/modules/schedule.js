import { db, resolveClassGroupId } from '../../database/schema.js';

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/**
 * Menghitung nomor minggu KBM saat ini berdasarkan tanggal mulai semester
 * @param {string} semesterStartDateStr e.g. "2026-07-13"
 * @param {Date} targetDate
 * @returns {number} Minggu ke-X (minimal 1)
 */
export function calculateWeekNumber(semesterStartDateStr, targetDate = new Date()) {
  const start = new Date(semesterStartDateStr);
  start.setHours(0, 0, 0, 0);

  const current = new Date(targetDate);
  current.setHours(0, 0, 0, 0);

  // Selisih hari
  const diffTime = current.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 1; // Belum mulai semester

  const weekNum = Math.floor(diffDays / 7) + 1;
  return weekNum;
}

/**
 * Mendapatkan informasi kelas
 */
export function getClassInfo(groupId) {
  const targetId = resolveClassGroupId(groupId);
  return db.prepare('SELECT * FROM classes WHERE group_id = ?').get(targetId);
}

/**
 * Penyederhanaan nama ruang agar bersih di header (contoh: "Ruang Teori (R.2)" -> "Ruang 2")
 */
function simplifyRoomName(room) {
  if (!room) return '';
  const matchR = room.match(/\(R\.?(\d+)\)/i) || room.match(/Ruang\s+(\d+)/i);
  if (matchR) return `Ruang ${matchR[1]}`;
  if (/lab/i.test(room)) return 'Lab RPL';
  return room;
}

/**
 * Penyederhanaan nama mapel (contoh: Pendidikan Agama Islam dan Budi Pekerti -> PAIBP)
 */
function simplifySubjectName(subject) {
  if (!subject) return '';
  const map = {
    'pendidikan agama islam dan budi pekerti': 'PAIBP',
    'bahasa indonesia': 'B. Indonesia',
    'bahasa inggris': 'B. Inggris',
    'bahasa jawa': 'B. Jawa',
    'pendidikan pancasila': 'PPKn',
    'sejarah indonesia': 'Sejarah',
    'kewirausahaan (pkk)': 'PKK',
    'mata pelajaran pilihan (bengkel)': 'Mata Pelajaran Pilihan (Bengkel)',
    'kejuruan rpl (bengkel / praktik)': 'Kejuruan RPL (Bengkel / Praktik)',
    'bengkel / praktik kejuruan rpl': 'Kejuruan RPL (Bengkel / Praktik)'
  };
  return map[subject.toLowerCase().trim()] || subject;
}

/**
 * Penyederhanaan nama guru (contoh: Muhammad Husnurridlo Az Zaini, M.Pd -> Zain)
 */
function simplifyTeacherName(teacher) {
  if (!teacher) return '';
  const map = {
    'muhammad husnurridlo az zaini, m.pd': 'Zain',
    'wasis sambodo winoto, s.pd': 'Wasis',
    'firman arya dani, s.pd.': 'Firman',
    'wahyu setiyani, s.pd': 'Wahyu',
    'sellya harwin arduana, s.pd': 'Sellya',
    'endah inugati, s.pd': 'Endah',
    'dwi murdianto, se': 'Dwi',
    'evania kurniawati, s.pd': 'Evania',
    'gunaryoko, s.kom': 'Gunaryoko',
    'heri handayani, s.pd': 'Heri',
    'bambang suwarno, s.st': 'Bambang',
    'vira ridho hidayati, s.pd': 'Vira'
  };
  return map[teacher.toLowerCase().trim()] || teacher.split(',')[0].trim();
}

/**
 * Format satu item jadwal menjadi string WhatsApp Rich Text
 */
function formatScheduleItem(item) {
  let text = `📖 *Mapel:* ${item.subject_name}\n`;
  text += `👨‍🏫 *Guru:* ${item.teacher_name}\n`;
  text += `📍 *Ruang:* ${item.room_name}\n`;
  text += `⏰ *Jam:* \`\`\`${item.time_start} - ${item.time_end}\`\`\`\n`;
  return text;
}

/**
 * Format item jadwal untuk blok bengkel (ringkas tanpa rincian jam harian)
 */
function formatBengkelItem(item) {
  let text = `📖 *Mapel:* ${item.subject_name}\n`;
  text += `👨‍🏫 *Guru:* ${item.teacher_name}\n`;
  text += `📍 *Ruang:* ${item.room_name}\n`;
  return text;
}

/**
 * Handler /jadwal (Jadwal Hari Ini)
 */
export function getScheduleToday(groupId, date = new Date()) {
  groupId = resolveClassGroupId(groupId);
  const classInfo = getClassInfo(groupId);
  if (!classInfo) return '⚠️ Kelas belum terdaftar di sistem bot.';

  const dayIndex = date.getDay(); // 0: Minggu, 1: Senin, ..., 5: Jumat, 6: Sabtu
  const weekNumber = calculateWeekNumber(classInfo.semester_start_date, date);

  if (dayIndex === 0 || dayIndex === 6) {
    return `🎉 *Hari ${DAYS[dayIndex]} - Libur Akhir Pekan!*\nTidak ada KBM hari ini. Gunakan waktu untuk istirahat atau cek \`/jadwal besok\` / \`/jadwal full\`.`;
  }

  const items = db.prepare(`
    SELECT * FROM schedules 
    WHERE group_id = ? AND week_number = ? AND day_index = ?
    ORDER BY time_start ASC
  `).all(groupId, weekNumber, dayIndex);

  if (items.length === 0) {
    return `ℹ️ Belum ada data jadwal untuk hari *${DAYS[dayIndex]} (Minggu ke-${weekNumber})*.`;
  }

  let res = `📅 *JADWAL KBM HARI INI (${DAYS[dayIndex]})*\n`;
  res += `🏫 Kelas: *${classInfo.class_name}* | Minggu ke: *${weekNumber}*\n`;
  res += `────────────────────────────\n\n`;

  res += items.map(formatScheduleItem).join('\n');
  res += `\n💡 _Ketik \`/jadwal besok\` untuk jadwal esok hari atau \`/jadwal full\` untuk satu minggu penuh._`;
  return res;
}

/**
 * Handler /jadwal besok
 */
export function getScheduleTomorrow(groupId) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getScheduleToday(groupId, tomorrow);
}

/**
 * Handler /jadwal [nama_hari]
 */
export function getScheduleByDay(groupId, dayName) {
  groupId = resolveClassGroupId(groupId);
  const classInfo = getClassInfo(groupId);
  if (!classInfo) return '⚠️ Kelas belum terdaftar di sistem bot.';

  const dayLower = dayName.toLowerCase().trim();
  const map = { 'senin': 1, 'selasa': 2, 'rabu': 3, 'kamis': 4, 'jumat': 5 };
  const targetDayIndex = map[dayLower];

  if (!targetDayIndex) {
    return `⚠️ Nama hari tidak valid. Pilihan: *senin, selasa, rabu, kamis, jumat*.`;
  }

  const weekNumber = calculateWeekNumber(classInfo.semester_start_date);
  const items = db.prepare(`
    SELECT * FROM schedules 
    WHERE group_id = ? AND week_number = ? AND day_index = ?
    ORDER BY time_start ASC
  `).all(groupId, weekNumber, targetDayIndex);

  if (items.length === 0) {
    return `ℹ️ Tidak ada jadwal pada hari *${DAYS[targetDayIndex]} (Minggu ke-${weekNumber})*.`;
  }

  let res = `📅 *JADWAL HARI ${DAYS[targetDayIndex].toUpperCase()} (Minggu ke-${weekNumber})*\n`;
  res += `🏫 Kelas: *${classInfo.class_name}*\n`;
  res += `────────────────────────────\n\n`;
  res += items.map(formatScheduleItem).join('\n');
  return res;
}

/**
 * Handler /jadwal full / minggu [angka] / depan / lalu
 */
export function getScheduleFull(groupId, targetWeek = null) {
  groupId = resolveClassGroupId(groupId);
  const classInfo = getClassInfo(groupId);
  if (!classInfo) return '⚠️ Kelas belum terdaftar di sistem bot.';

  const currentWeek = calculateWeekNumber(classInfo.semester_start_date);
  let weekNumber = currentWeek;

  if (typeof targetWeek === 'string') {
    const lower = targetWeek.toLowerCase().trim();
    if (lower === 'depan' || lower === 'minggu depan') {
      weekNumber = currentWeek + 1;
    } else if (lower === 'lalu' || lower === 'minggu lalu') {
      weekNumber = currentWeek - 1;
    } else {
      const m = lower.match(/^(?:minggu\s+)?(\d+)$/);
      if (m) {
        weekNumber = parseInt(m[1], 10);
      } else if (!isNaN(parseInt(lower, 10))) {
        weekNumber = parseInt(lower, 10);
      }
    }
  } else if (typeof targetWeek === 'number') {
    weekNumber = targetWeek;
  }

  if (isNaN(weekNumber) || weekNumber <= 0) {
    return '⚠️ Nomor minggu tidak valid (minimal Minggu ke-1).';
  }

  const items = db.prepare(`
    SELECT * FROM schedules 
    WHERE group_id = ? AND week_number = ?
    ORDER BY day_index ASC, time_start ASC
  `).all(groupId, weekNumber);

  if (items.length === 0) {
    return `ℹ️ Belum ada rekap jadwal untuk Minggu ke-${weekNumber}.`;
  }

  // Cari nama ruangan yang dominan pada minggu ini
  const rawRoom = items.find(i => i.room_name)?.room_name || '';
  const cleanRoom = simplifyRoomName(rawRoom);
  const headerRoom = cleanRoom ? ` ${cleanRoom}` : '';

  let res = `🗓️ Minggu Ke-${weekNumber}${headerRoom}\n`;
  res += `────────────────────────────\n`;

  // Filter mengabaikan refleksi jumat / wali kelas
  const mainItems = items.filter(i => 
    i.teacher_name !== 'Guru Pendamping / Wali Kelas' && 
    !i.subject_name.toLowerCase().includes('refleksi')
  );
  const sourceItems = mainItems.length > 0 ? mainItems : items;

  // Dapatkan daftar unik berdasarkan mapel dan guru yang sudah disederhanakan
  const uniqueItems = [];
  const seen = new Set();
  for (const it of sourceItems) {
    const sName = simplifySubjectName(it.subject_name);
    const tName = simplifyTeacherName(it.teacher_name);
    const key = `${sName.toLowerCase()}|${tName.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueItems.push({ subject_name: sName, teacher_name: tName });
    }
  }

  // Format list nomor berurutan sesuai contoh:
  // 1.  Mapel: PAIBP
  //     Guru: Zain
  const listFormatted = uniqueItems.map((it, idx) => {
    return `${idx + 1}.  Mapel: ${it.subject_name}\n    Guru: ${it.teacher_name}`;
  }).join('\n');

  res += listFormatted;
  return res;
}

/**
 * Handler /jadwal now
 */
export function getScheduleNow(groupId) {
  groupId = resolveClassGroupId(groupId);
  const classInfo = getClassInfo(groupId);
  if (!classInfo) return '⚠️ Kelas belum terdaftar di sistem bot.';

  const now = new Date();
  const dayIndex = now.getDay();
  const weekNumber = calculateWeekNumber(classInfo.semester_start_date, now);

  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const items = db.prepare(`
    SELECT * FROM schedules 
    WHERE group_id = ? AND week_number = ? AND day_index = ?
      AND time_start <= ? AND time_end >= ?
  `).all(groupId, weekNumber, dayIndex, currentTime, currentTime);

  if (items.length === 0) {
    return `🕒 Saat ini (\`\`\`${currentTime}\`\`\`) tidak ada mata pelajaran yang sedang berlangsung.`;
  }

  let res = `🔔 *MAPEL SEDANG BERLANGSUNG SAAT INI*\n`;
  res += `────────────────────────────\n`;
  res += items.map(formatScheduleItem).join('\n');
  return res;
}

/**
 * Handler /jadwal cari [nama_guru]
 */
export function searchScheduleByTeacher(groupId, teacherQuery) {
  groupId = resolveClassGroupId(groupId);
  const items = db.prepare(`
    SELECT * FROM schedules 
    WHERE group_id = ? AND teacher_name LIKE ?
    ORDER BY week_number ASC, day_index ASC
  `).all(groupId, `%${teacherQuery}%`);

  if (items.length === 0) {
    return `🔍 Tidak ditemukan jadwal mengajar untuk guru: *${teacherQuery}*.`;
  }

  let res = `🔍 *HASIL PENCARIAN GURU: "${teacherQuery}"*\n`;
  res += `Ditemukan ${items.length} sesi mengajar:\n────────────────────────────\n\n`;

  items.forEach(i => {
    res += `• *Minggu ke-${i.week_number} (${DAYS[i.day_index]})*: ${i.subject_name}\n  📍 ${i.room_name} (\`\`\`${i.time_start}-${i.time_end}\`\`\`)\n`;
  });

  return res;
}

/**
 * Tambah jadwal pelajaran manual
 * format: /jadwal add [minggu] | [hari: senin-jumat] | [tipe: TEORI/BENGKEL] | [mapel] | [guru] | [ruang] | [jam: 07:00-15:30] | [catatan]
 */
export function addScheduleItem(groupId, argsText) {
  groupId = resolveClassGroupId(groupId);
  const parts = argsText.split('|').map(p => p.trim());
  if (parts.length < 7) {
    return `⚠️ Format salah!\nGunakan: \`/jadwal add [minggu_ke] | [nama_hari] | [TEORI/BENGKEL] | [mapel] | [nama_guru] | [ruangan] | [jam_mulai-jam_selesai] | [catatan opsional]\`\n\nContoh:\n\`/jadwal add 1 | senin | TEORI | Pemrograman Web | Pak Budi, S.Kom | R.2 | 07:00-15:30 | Bawa Laptop\``;
  }

  const [weekStr, dayStr, blockTypeRaw, subject, teacher, room, timeStr, notes = ''] = parts;
  const weekNumber = parseInt(weekStr, 10);
  const blockType = blockTypeRaw.toUpperCase();
  const dayLower = dayStr.toLowerCase();
  const map = { 'senin': 1, 'selasa': 2, 'rabu': 3, 'kamis': 4, 'jumat': 5 };
  const dayIndex = map[dayLower];

  if (isNaN(weekNumber) || !dayIndex || !['TEORI', 'BENGKEL'].includes(blockType)) {
    return '⚠️ Parameter tidak valid. Pastikan minggu berupa angka (1-20), hari (senin-jumat), dan blok (TEORI/BENGKEL).';
  }

  const [timeStart, timeEnd] = timeStr.split('-').map(t => t.trim());

  db.prepare(`
    INSERT INTO schedules (group_id, week_number, day_index, block_type, subject_name, teacher_name, room_name, time_start, time_end, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(groupId, weekNumber, dayIndex, blockType, subject, teacher, room, timeStart || '07:00', timeEnd || '15:30', notes);

  return `✅ Jadwal berhasil ditambahkan!\n• *Minggu ke:* ${weekNumber}\n• *Hari:* ${DAYS[dayIndex]}\n• *Blok:* ${blockType}\n• *Mapel:* ${subject} (${teacher})\n• *Ruang:* ${room}`;
}

/**
 * Hapus jadwal berdasarkan ID
 */
export function deleteScheduleItem(groupId, id) {
  groupId = resolveClassGroupId(groupId);
  const res = db.prepare('DELETE FROM schedules WHERE group_id = ? AND id = ?').run(groupId, id);
  if (res.changes === 0) return `⚠️ Jadwal dengan ID ${id} tidak ditemukan.`;
  return `🗑️ Jadwal dengan ID ${id} berhasil dihapus.`;
}

/**
 * Edit jadwal per minggu atau per hari
 * Format 1 (per minggu): /jadwal edit [minggu] | [field] | [nilai_baru]
 * Format 2 (per hari)  : /jadwal edit [minggu] | [hari] | [field] | [nilai_baru]
 */
export function editScheduleItem(groupId, argsText) {
  groupId = resolveClassGroupId(groupId);
  const parts = argsText.split('|').map(p => p.trim());
  if (parts.length < 3) {
    return `⚠️ Format salah!\nGunakan:\n• \`/jadwal edit [minggu] | [field] | [nilai_baru]\`\n• \`/jadwal edit [minggu] | [hari] | [field] | [nilai_baru]\`\n\nPilihan field: *ruang, guru, mapel, blok, catatan*\n\nContoh:\n\`/jadwal edit 14 | ruang | Ruang 5\`\n\`/jadwal edit 13 | senin | ruang | R.4\``;
  }

  const DAY_MAP = { 'senin': 1, 'selasa': 2, 'rabu': 3, 'kamis': 4, 'jumat': 5 };
  let weekStr, dayStr = null, fieldStr, newValue;

  if (parts.length === 3) {
    [weekStr, fieldStr, newValue] = parts;
  } else {
    // parts.length >= 4
    if (DAY_MAP[parts[1].toLowerCase()]) {
      weekStr = parts[0];
      dayStr = parts[1];
      fieldStr = parts[2];
      newValue = parts.slice(3).join('|').trim();
    } else {
      weekStr = parts[0];
      fieldStr = parts[1];
      newValue = parts.slice(2).join('|').trim();
    }
  }

  const weekMatch = weekStr.match(/\d+/);
  if (!weekMatch) {
    return '⚠️ Nomor minggu tidak valid. Gunakan angka, contoh: `/jadwal edit 14 | ruang | Ruang 5`';
  }
  const weekNumber = parseInt(weekMatch[0], 10);

  let dayIndex = null;
  if (dayStr) {
    dayIndex = DAY_MAP[dayStr.toLowerCase()];
    if (!dayIndex) {
      return '⚠️ Nama hari tidak valid. Pilihan hari: *senin, selasa, rabu, kamis, jumat*.';
    }
  }

  const fieldLower = fieldStr.toLowerCase().trim();
  let dbColumn = null;
  let fieldLabel = '';

  if (['ruang', 'ruangan', 'room'].includes(fieldLower)) {
    dbColumn = 'room_name';
    fieldLabel = 'Ruang';
  } else if (['guru', 'pengampu', 'teacher'].includes(fieldLower)) {
    dbColumn = 'teacher_name';
    fieldLabel = 'Guru';
  } else if (['mapel', 'pelajaran', 'subject'].includes(fieldLower)) {
    dbColumn = 'subject_name';
    fieldLabel = 'Mata Pelajaran';
  } else if (['blok', 'tipe', 'block'].includes(fieldLower)) {
    dbColumn = 'block_type';
    fieldLabel = 'Tipe Blok';
    newValue = newValue.toUpperCase();
    if (!['TEORI', 'BENGKEL'].includes(newValue)) {
      return '⚠️ Nilai blok harus berupa *TEORI* atau *BENGKEL*.';
    }
  } else if (['catatan', 'notes', 'note'].includes(fieldLower)) {
    dbColumn = 'notes';
    fieldLabel = 'Catatan';
  } else {
    return `⚠️ Kolom *"${fieldStr}"* tidak dikenal!\nPilihan yang dapat diedit: *ruang, guru, mapel, blok, catatan*.`;
  }

  if (!newValue) {
    return `⚠️ Nilai perubahan untuk *${fieldLabel}* tidak boleh kosong.`;
  }

  // Cek keberadaan jadwal di minggu tersebut
  let checkQuery = 'SELECT COUNT(*) as count FROM schedules WHERE group_id = ? AND week_number = ?';
  const checkParams = [groupId, weekNumber];
  if (dayIndex) {
    checkQuery += ' AND day_index = ?';
    checkParams.push(dayIndex);
  }
  const existing = db.prepare(checkQuery).get(...checkParams);

  if (!existing || existing.count === 0) {
    return `⚠️ Tidak ditemukan jadwal untuk Minggu ke-${weekNumber}${dayIndex ? ` hari ${DAYS[dayIndex]}` : ''}.`;
  }

  // Lakukan update data
  let updateQuery = `UPDATE schedules SET ${dbColumn} = ? WHERE group_id = ? AND week_number = ?`;
  const updateParams = [newValue, groupId, weekNumber];
  if (dayIndex) {
    updateQuery += ' AND day_index = ?';
    updateParams.push(dayIndex);
  }
  const res = db.prepare(updateQuery).run(...updateParams);

  let resText = `✅ *JADWAL BERHASIL DIPERBARUI!*\n`;
  resText += `────────────────────────────\n`;
  resText += `• *Minggu ke:* ${weekNumber}\n`;
  if (dayIndex) {
    resText += `• *Hari:* ${DAYS[dayIndex]}\n`;
  } else {
    resText += `• *Cakupan:* Seluruh Hari (Minggu ke-${weekNumber})\n`;
  }
  resText += `• *Field:* ${fieldLabel}\n`;
  resText += `• *Perubahan:* ${newValue}\n`;
  resText += `• *Jumlah Sesi Terupdate:* ${res.changes} sesi\n\n`;
  resText += `💡 _Ketik \`/jadwal minggu ${weekNumber}\` untuk melihat jadwal terbaru._`;
  return resText;
}

/**
 * Handler /jam [hari]
 * Menampilkan daftar jam pelajaran KBM (Senin - Jumat)
 */
export function getLessonHours(groupId, dayArg = '') {
  const LESSON_SCHEDULES = {
    1: {
      name: 'Senin',
      slots: [
        '07.50 - 09.10',
        '09.10 - 10.45',
        '10.45 - 12.05',
        '12.50 - 14.10',
        '14.10 - 15.30'
      ]
    },
    2: {
      name: 'Selasa',
      slots: [
        '07.00 - 08.30',
        '08.30 - 10.00',
        '10.15 - 11.45',
        '12.30 - 14.00',
        '14.00 - 15.30'
      ]
    },
    3: {
      name: 'Rabu',
      slots: [
        '07.00 - 08.30',
        '08.30 - 10.00',
        '10.15 - 11.45',
        '12.30 - 14.00',
        '14.00 - 15.30'
      ]
    },
    4: {
      name: 'Kamis',
      slots: [
        '07.00 - 08.30',
        '08.30 - 10.00',
        '10.15 - 11.45',
        '12.30 - 14.00',
        '14.00 - 15.00'
      ]
    },
    5: {
      name: 'Jumat',
      slots: [
        '07.00 - 08.30',
        '08.30 - 10.00',
        '10.15 - 11.45',
        '13.00 - 14.30',
        '14.30 - 15.15',
        '15.15 - 16.00'
      ]
    }
  };

  const dayMap = {
    'senin': 1,
    'selasa': 2,
    'rabu': 3,
    'kamis': 4,
    'jumat': 5,
    'sabtu': 6,
    'minggu': 0
  };

  const cleanArg = (dayArg || '').toLowerCase().trim();

  // Jika user memasukkan hari libur
  if (cleanArg === 'sabtu' || cleanArg === 'minggu') {
    return `🎉 *Hari ${cleanArg === 'sabtu' ? 'Sabtu' : 'Minggu'} - Libur Akhir Pekan!*\nKBM hanya berlangsung hari Senin s/d Jumat. Ketik \`/jam\` untuk melihat jadwal jam pelajaran.`;
  }

  // Jika user memasukkan argumen tapi tidak valid
  if (cleanArg && !dayMap[cleanArg]) {
    return `⚠️ Nama hari tidak valid.\nPilihan: *senin, selasa, rabu, kamis, jumat*.\nAtau ketik \`/jam\` untuk menampilkan seluruh hari.`;
  }

  let res = `🗓️ Jam Pelajaran\n`;
  res += `────────────────────────────\n`;

  // Jika spesifik satu hari (contoh: /jam senin)
  if (cleanArg && dayMap[cleanArg] >= 1 && dayMap[cleanArg] <= 5) {
    const dayData = LESSON_SCHEDULES[dayMap[cleanArg]];
    res += `${dayData.name}\n`;
    dayData.slots.forEach((slot, idx) => {
      res += `${idx + 1}. ${slot}\n`;
    });
    return res.trimEnd();
  }

  // Jika tanpa argumen: tampilkan Senin s/d Jumat
  for (let d = 1; d <= 5; d++) {
    const dayData = LESSON_SCHEDULES[d];
    res += `${dayData.name}\n`;
    dayData.slots.forEach((slot, idx) => {
      res += `${idx + 1}. ${slot}\n`;
    });
    if (d < 5) res += '\n';
  }

  return res.trimEnd();
}
