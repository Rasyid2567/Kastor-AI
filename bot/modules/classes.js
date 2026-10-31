import { db, resolveClassGroupId, getLinkedGroups } from '../../database/schema.js';

/**
 * Mendapatkan daftar seluruh kelas induk yang terdaftar
 */
export function getAvailableClasses() {
  return db.prepare(`
    SELECT c.group_id, c.class_name, c.academic_year,
           (SELECT COUNT(*) FROM class_groups cg WHERE cg.target_group_id = c.group_id) as linked_count
    FROM classes c
    ORDER BY c.class_name ASC
  `).all();
}

/**
 * Parsing argumen perintah /link secara cerdas:
 * Mendukung greedy match nama kelas berspasi (misal: "XI RPL C Khusus Putra"),
 * nomor indeks (misal: "1 Putra"), maupun format pemisah pipa (misal: "XI RPL C | Cowok").
 */
export function parseLinkArguments(rawArgs) {
  const text = (rawArgs || '').trim();
  if (!text) {
    return { targetIdentifier: '', groupLabel: '' };
  }

  if (text.includes('|')) {
    const [t, ...rest] = text.split('|');
    return { targetIdentifier: t.trim(), groupLabel: rest.join('|').trim() };
  }

  const allClasses = getAvailableClasses();

  // 1. Cek apakah diawali nomor urut kelas (misal: "1", "1 Cowok")
  const numMatch = text.match(/^(\d+)(?:\s+(.*))?$/);
  if (numMatch) {
    const idx = parseInt(numMatch[1], 10);
    if (idx >= 1 && idx <= allClasses.length) {
      return {
        targetIdentifier: numMatch[1],
        groupLabel: (numMatch[2] || '').trim()
      };
    }
  }

  // 2. Greedy match dengan nama kelas terdaftar (urutkan dari nama kelas terpanjang)
  const sortedClasses = [...allClasses].sort((a, b) => b.class_name.length - a.class_name.length);
  const textLower = text.toLowerCase();

  for (const c of sortedClasses) {
    const cNameLower = c.class_name.toLowerCase();
    if (textLower === cNameLower) {
      return { targetIdentifier: c.class_name, groupLabel: '' };
    }
    if (textLower.startsWith(cNameLower + ' ')) {
      const remainder = text.slice(c.class_name.length).trim();
      return { targetIdentifier: c.class_name, groupLabel: remainder };
    }
  }

  // 3. Fallback pemisahan spasi biasa
  const parts = text.split(' ');
  return {
    targetIdentifier: parts[0],
    groupLabel: parts.slice(1).join(' ').trim()
  };
}

/**
 * Menghubungkan grup WhatsApp (rawGroupId) ke sebuah kelas induk (targetIdentifier)
 * targetIdentifier bisa berupa nomor indeks (1, 2, ...), group_id lengkap, atau nama kelas.
 */
export function linkGroupToClass(rawGroupId, targetIdentifier, groupLabel = '') {
  if (!rawGroupId) {
    return { ok: false, message: '⚠️ Group ID WhatsApp tidak valid.' };
  }

  // 1. Cek apakah grup ini sudah merupakan kelas induk utama di tabel classes
  const isPrimary = db.prepare('SELECT class_name FROM classes WHERE group_id = ?').get(rawGroupId);
  if (isPrimary) {
    return {
      ok: false,
      message: `⚠️ Grup ini sudah terdaftar sebagai Kelas Utama (*${isPrimary.class_name}*).\n` +
        `Kelas utama tidak dapat dihubungkan ke kelas lain.`
    };
  }

  // 2. Cek apakah grup ini sudah terhubung ke kelas lain di class_groups
  const existingLink = db.prepare(`
    SELECT cg.*, c.class_name 
    FROM class_groups cg 
    JOIN classes c ON cg.target_group_id = c.group_id 
    WHERE cg.group_id = ?
  `).get(rawGroupId);

  if (existingLink) {
    return {
      ok: false,
      isAlreadyLinked: true,
      className: existingLink.class_name,
      currentLabel: existingLink.group_label || 'Cabang',
      message: `ℹ️ Grup ini sudah terhubung ke kelas *${existingLink.class_name}* dengan penanda *${existingLink.group_label || 'Cabang'}*.\n\n` +
        `• Untuk mengubah nama penanda grup: \`/link label [nama_penanda_baru]\`\n` +
        `• Untuk memutuskan hubungan grup: \`/unlink\``
    };
  }

  // 3. Cari kelas induk target
  const cleanTarget = (targetIdentifier || '').trim();
  if (!cleanTarget) {
    const list = getAvailableClasses();
    if (list.length === 0) {
      return { ok: false, message: 'ℹ️ Belum ada kelas yang terdaftar di bot ini. Buat kelas utama dengan `/init [nama_kelas]`.' };
    }

    let menu = `🔗 *PENGHUBUNG GRUP KE KELAS (MULTI-GROUP)*\n` +
      `Grup ini belum terhubung ke kelas manapun.\n\n` +
      `📌 *Daftar Kelas yang Tersedia:*\n`;

    list.forEach((c, idx) => {
      menu += `${idx + 1}. *${c.class_name}* (${c.linked_count} grup terhubung)\n` +
        `   ID: \`\`\`${c.group_id}\`\`\`\n`;
    });

    menu += `\n💡 *Cara Menghubungkan:*\n` +
      `Ketik: \`/link [nomor atau nama_kelas]\`\n` +
      `Contoh: \`/link 1\` atau \`/link ${list[0].class_name}\`\n\n` +
      `_Catatan: Hanya Admin Grup WhatsApp atau Developer yang dapat menghubungkan grup._`;

    return { ok: false, message: menu };
  }

  let targetClass = null;
  const numIndex = parseInt(cleanTarget, 10);
  const allClasses = getAvailableClasses();

  if (!isNaN(numIndex) && numIndex >= 1 && numIndex <= allClasses.length && !cleanTarget.includes('@')) {
    targetClass = allClasses[numIndex - 1];
  } else {
    // Cari by group_id persis atau by class_name (case-insensitive)
    targetClass = db.prepare(`
      SELECT group_id, class_name 
      FROM classes 
      WHERE group_id = ? OR LOWER(class_name) = LOWER(?)
    `).get(cleanTarget, cleanTarget);

    if (!targetClass) {
      // Cari dengan wildcard LIKE
      targetClass = db.prepare(`
        SELECT group_id, class_name 
        FROM classes 
        WHERE LOWER(class_name) LIKE LOWER(?)
      `).get(`%${cleanTarget}%`);
    }
  }

  if (!targetClass) {
    return {
      ok: false,
      message: `❌ Kelas "*${cleanTarget}*" tidak ditemukan.\nKetik \`/link\` tanpa argumen untuk melihat daftar kelas yang tersedia.`
    };
  }

  // 4. Daftarkan tautan ke tabel class_groups
  const finalLabel = groupLabel.trim() || 'Cabang';
  db.prepare(`
    INSERT INTO class_groups (group_id, target_group_id, group_label)
    VALUES (?, ?, ?)
  `).run(rawGroupId, targetClass.group_id, finalLabel);

  return {
    ok: true,
    className: targetClass.class_name,
    targetGroupId: targetClass.group_id,
    label: finalLabel,
    message: `🎉 *GRUP BERHASIL DIHUBUNGKAN!* 🎉\n` +
      `────────────────────────────\n` +
      `🏫 *Kelas Induk:* *${targetClass.class_name}*\n` +
      `🆔 *ID Kelas Induk:* \`\`\`${targetClass.group_id}\`\`\`\n` +
      `🏷️ *Label Grup:* ${finalLabel}\n\n` +
      `👥 *Fitur yang Tersinkronisasi:*\n` +
      `• 📅 *Jadwal Pelajaran:* Sesuai kelas ${targetClass.class_name}\n` +
      `• 📝 *Tugas & PR:* Sinkron otomatis (pengingat jam 19.00 aktif di sini)\n` +
      `• 💰 *Kas Kelas:* Terhubung langsung ke data kas induk\n` +
      `• 👥 *Data Siswa:* Terhubung ke data siswa induk\n` +
      `• 🏛️ *Struktur Pengurus:* Diakui otomatis di grup ini\n\n` +
      `💡 _Perintah \`/tagall\` dan \`/hidetag\` tetap hanya men-tag anggota di grup ini saja._\n` +
      `Ketik \`/unlink\` jika sewaktu-waktu ingin memutuskan hubungan.`
  };
}

/**
 * Memutuskan tautan grup cabang dari kelas induk
 */
export function unlinkGroup(rawGroupId) {
  if (!rawGroupId) {
    return { ok: false, message: '⚠️ Group ID WhatsApp tidak valid.' };
  }

  const link = db.prepare(`
    SELECT cg.*, c.class_name 
    FROM class_groups cg 
    JOIN classes c ON cg.target_group_id = c.group_id 
    WHERE cg.group_id = ?
  `).get(rawGroupId);

  if (!link) {
    return {
      ok: false,
      message: 'ℹ️ Grup ini tidak sedang terhubung ke kelas manapun sebagai grup cabang.'
    };
  }

  db.prepare('DELETE FROM class_groups WHERE group_id = ?').run(rawGroupId);

  return {
    ok: true,
    message: `✅ *Tautan Grup Berhasil Diputuskan!*\n` +
      `Grup ini telah dilepas dari kelas *${link.class_name}*.\n\n` +
      `Untuk menghubungkan kembali, gunakan \`/link [nama_kelas]\`.\n` +
      `Untuk membuat kelas mandiri baru di grup ini, gunakan \`/init [nama_kelas]\`.`
  };
}

/**
 * Menampilkan daftar grup yang terhubung ke kelas ini
 */
export function listLinkedGroups(groupId) {
  const classGroupId = resolveClassGroupId(groupId);
  const mainClass = db.prepare('SELECT group_id, class_name FROM classes WHERE group_id = ?').get(classGroupId);

  if (!mainClass) {
    return 'ℹ️ Kelas ini belum diinisialisasi.';
  }

  const linked = db.prepare('SELECT group_id, group_label, created_at FROM class_groups WHERE target_group_id = ?').all(classGroupId);

  let text = `🔗 *DAFTAR GRUP TERHUBUNG*\n` +
    `🏫 *Kelas Induk:* *${mainClass.class_name}*\n` +
    `────────────────────────────\n` +
    `*Grup WhatsApp Utama:* \`\`\`${mainClass.group_id}\`\`\`\n`;

  if (linked.length === 0) {
    text += `\n_Belum ada grup cabang (putra/putri) yang dihubungkan._\n` +
      `💡 Untuk menghubungkan grup lain, ketik \`/link ${mainClass.class_name}\` di grup tersebut.`;
  } else {
    text += `\n📌 *Grup Cabang Terhubung (${linked.length}):*\n`;
    linked.forEach((lg, i) => {
      text += `${i + 1}. *Label Penanda:* ${lg.group_label || 'Cabang'}\n` +
        `   ID: \`\`\`${lg.group_id}\`\`\`\n`;
    });
  }

  return text;
}

/**
 * Memperbarui nama penanda / label grup cabang yang sudah terhubung
 */
export function updateLinkedGroupLabel(rawGroupId, newLabel) {
  if (!rawGroupId) {
    return { ok: false, message: '⚠️ Group ID WhatsApp tidak valid.' };
  }

  const cleanLabel = (newLabel || '').trim();
  if (!cleanLabel) {
    return { ok: false, message: '⚠️ Nama penanda/label grup tidak boleh kosong.' };
  }

  const existingLink = db.prepare(`
    SELECT cg.*, c.class_name 
    FROM class_groups cg 
    JOIN classes c ON cg.target_group_id = c.group_id 
    WHERE cg.group_id = ?
  `).get(rawGroupId);

  if (!existingLink) {
    return {
      ok: false,
      message: 'ℹ️ Grup ini tidak sedang terhubung ke kelas manapun sebagai grup cabang.\n' +
        'Gunakan `/link [nama_kelas]` terlebih dahulu untuk menghubungkan grup ini.'
    };
  }

  db.prepare('UPDATE class_groups SET group_label = ? WHERE group_id = ?').run(cleanLabel, rawGroupId);

  return {
    ok: true,
    className: existingLink.class_name,
    newLabel: cleanLabel,
    message: `✅ *Nama Penanda Grup Berhasil Diperbarui!*\n` +
      `────────────────────────────\n` +
      `🏫 *Kelas Induk:* *${existingLink.class_name}*\n` +
      `🏷️ *Penanda Baru:* *${cleanLabel}*\n\n` +
      `_Nama penanda ini otomatis tampil di daftar grup dan Web Dashboard._`
  };
}
