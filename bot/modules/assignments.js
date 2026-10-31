import { db, getLinkedGroups, resolveClassGroupId } from '../../database/schema.js';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';

/**
 * Resolusi LID ke nomor telepon WhatsApp via data sesi Baileys
 */
export function resolveLidToPhone(lid) {
  try {
    const cleanLid = lid.replace(/[^0-9]/g, '');
    const reverseFile = path.resolve('auth_info_baileys', `lid-mapping-${cleanLid}_reverse.json`);
    if (fs.existsSync(reverseFile)) {
      return JSON.parse(fs.readFileSync(reverseFile, 'utf8'));
    }
  } catch {}
  return null;
}

/**
 * Resolusi nomor telepon ke LID via data sesi Baileys
 */
export function resolvePhoneToLid(phone) {
  try {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const mappingFile = path.resolve('auth_info_baileys', `lid-mapping-${cleanPhone}.json`);
    if (fs.existsSync(mappingFile)) {
      return JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
    }
  } catch {}
  return null;
}

/**
 * Normalisasi nomor telepon format Indonesia (08xxx / 8xxx -> 628xxx)
 */
export function normalizeIndonesianPhone(num) {
  let clean = (num || '').replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) clean = '62' + clean.slice(1);
  else if (clean.startsWith('8')) clean = '62' + clean;
  return clean;
}

/**
 * Validasi apakah pengirim adalah Developer / Superadmin
 */
export function isDeveloper(senderJid, devConfig = process.env.DEVELOPER_NUMBER) {
  if (!devConfig || !senderJid) return false;

  const cleanJid = senderJid.replace(/:.*@/, '@');
  const senderDigits = cleanJid.split('@')[0];
  const isLid = cleanJid.endsWith('@lid');

  const devList = devConfig.split(',').map(d => d.trim().replace(/[^0-9]/g, '')).filter(Boolean);

  for (const rawDev of devList) {
    const devNormalized = normalizeIndonesianPhone(rawDev);
    if (senderDigits === rawDev || senderDigits === devNormalized) return true;

    if (isLid) {
      const resolvedPhone = resolveLidToPhone(senderDigits);
      if (resolvedPhone) {
        const resolvedNormalized = normalizeIndonesianPhone(resolvedPhone);
        if (resolvedPhone === rawDev || resolvedNormalized === devNormalized) {
          return true;
        }
      }
    } else {
      const senderNormalized = normalizeIndonesianPhone(senderDigits);
      if (senderNormalized === devNormalized) return true;

      const devLid = resolvePhoneToLid(rawDev) || resolvePhoneToLid(devNormalized);
      if (devLid && senderDigits === devLid) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Validasi apakah nomor pengirim adalah admin (Ketua / Sekretaris / Developer)
 */
export function isClassAdmin(groupId, senderJid, devNumber) {
  if (isDeveloper(senderJid, devNumber)) {
    return true;
  }

  groupId = resolveClassGroupId(groupId);
  const cleanJid = senderJid.replace(/:.*@/, '@');
  const role = db.prepare(`
    SELECT role FROM class_roles 
    WHERE group_id = ? AND (phone_number = ? OR phone_number = ?)
      AND role IN ('KETUA', 'SEKRETARIS')
  `).get(groupId, cleanJid, senderJid);

  if (role) return true;

  if (cleanJid.endsWith('@lid')) {
    const phone = resolveLidToPhone(cleanJid);
    if (phone) {
      const roleByPhone = db.prepare(`
        SELECT role FROM class_roles 
        WHERE group_id = ? AND (phone_number LIKE ? OR phone_number = ?)
          AND role IN ('KETUA', 'SEKRETARIS')
      `).get(groupId, `%${phone}%`, `${phone}@s.whatsapp.net`);
      if (roleByPhone) return true;
    }
  }

  return false;
}

/**
 * Menampilkan daftar tugas aktif (/pr)
 */
export function getActiveAssignments(groupId) {
  groupId = resolveClassGroupId(groupId);
  const items = db.prepare(`
    SELECT * FROM assignments 
    WHERE group_id = ? AND is_completed = 0 AND deadline >= datetime('now', 'localtime')
    ORDER BY deadline ASC
  `).all(groupId);

  if (items.length === 0) {
    return `🎉 *Tidak ada PR aktif!*\nSemua tugas telah selesai atau belum ada PR baru yang ditambahkan. Gunakan \`/pr all\` untuk riwayat tugas.`;
  }

  let text = `📝 *DAFTAR TUGAS & PR AKTIF*\n`;
  text += `────────────────────────────\n\n`;

  items.forEach(item => {
    text += `📌 *[ID: \`\`\`${item.id}\`\`\`]* *${item.subject}*\n`;
    text += `⏰ *Tenggat:* \`\`\`${item.deadline}\`\`\`\n`;
    text += `📖 *Keterangan:* ${item.description}\n`;
    text += `👤 *Dibuat oleh:* ${item.created_by}\n\n`;
  });

  text += `💡 _Ketik \`/pr detail [id]\` untuk rincian tugas._`;
  return text;
}

/**
 * Menampilkan seluruh riwayat PR (/pr all)
 */
export function getAllAssignments(groupId) {
  groupId = resolveClassGroupId(groupId);
  const items = db.prepare(`
    SELECT * FROM assignments 
    WHERE group_id = ? 
    ORDER BY id DESC LIMIT 20
  `).all(groupId);

  if (items.length === 0) {
    return `ℹ️ Belum ada riwayat tugas untuk kelas ini.`;
  }

  let text = `📚 *SELURUH RIWAYAT TUGAS & PR*\n`;
  text += `────────────────────────────\n\n`;

  items.forEach(item => {
    const status = item.is_completed ? '✅ Selesai' : '⏳ Belum Selesai';
    text += `• *[ID: \`\`\`${item.id}\`\`\`]* ${item.subject} (${status})\n  ⏰ Deadline: ${item.deadline}\n`;
  });

  return text;
}

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../../uploads/assignments');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Menampilkan detail tugas (/pr detail [id])
 */
export function getAssignmentDetail(groupId, id) {
  groupId = resolveClassGroupId(groupId);
  const item = db.prepare('SELECT * FROM assignments WHERE group_id = ? AND id = ?').get(groupId, id);
  if (!item) {
    return { text: `⚠️ Tugas dengan ID \`\`\`${id}\`\`\` tidak ditemukan.`, imagePath: null };
  }

  const status = item.is_completed ? '✅ Selesai' : '⏳ Belum Selesai';

  let text = `📋 *RINCIAN TUGAS [ID: \`\`\`${item.id}\`\`\`]*\n`;
  text += `────────────────────────────\n`;
  text += `📖 *Mata Pelajaran:* ${item.subject}\n`;
  text += `⏰ *Batas Waktu (Deadline):* \`\`\`${item.deadline}\`\`\`\n`;
  text += `📌 *Status:* ${status}\n`;
  text += `👤 *Pemberi Tugas:* ${item.created_by}\n`;
  text += `📝 *Deskripsi / Instruksi:*\n${item.description}\n`;
  if (item.image_path && fs.existsSync(item.image_path)) {
    text += `\n🖼️ _(Terdapat lampiran gambar pada tugas ini)_`;
  }

  return { text, imagePath: (item.image_path && fs.existsSync(item.image_path)) ? item.image_path : null };
}

/**
 * Menambahkan PR baru (/pr add [mapel] | [deadline: YYYY-MM-DD HH:mm] | [keterangan])
 * dengan dukungan lampiran gambar
 */
export function addAssignment(groupId, textArgs, creatorName, imageBuffer = null) {
  groupId = resolveClassGroupId(groupId);
  const parts = textArgs.split('|').map(p => p.trim());
  if (parts.length < 3) {
    return `⚠️ Format salah!\nGunakan: \`/pr add [mapel] | [YYYY-MM-DD HH:mm] | [keterangan]\`\nContoh: \`/pr add Web | 2026-10-15 23:59 | Bikin Navbar CSS\``;
  }

  const [subject, deadlineStr, description] = parts;

  // Validasi deadline string
  const deadlineDate = new Date(deadlineStr);
  if (isNaN(deadlineDate.getTime())) {
    return `⚠️ Format tanggal tidak valid. Gunakan format standar: \`YYYY-MM-DD HH:mm\` (Contoh: 2026-10-15 23:59).`;
  }

  let savedImagePath = null;
  if (imageBuffer) {
    const filename = `pr_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    savedImagePath = path.join(uploadsDir, filename);
    fs.writeFileSync(savedImagePath, imageBuffer);
  }

  const res = db.prepare(`
    INSERT INTO assignments (group_id, subject, description, deadline, created_by, is_completed, image_path)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `).run(groupId, subject, description, deadlineStr, creatorName, savedImagePath);

  let successMsg = `✅ *Tugas Berhasil Ditambahkan!*\n• *ID:* \`\`\`${res.lastInsertRowid}\`\`\`\n• *Mapel:* ${subject}\n• *Deadline:* ${deadlineStr}`;
  if (savedImagePath) {
    successMsg += `\n🖼️ *Lampiran:* Gambar tersimpan`;
  }
  return successMsg;
}

/**
 * Menandai tugas telah selesai (/pr done [id])
 */
export function completeAssignment(groupId, id) {
  groupId = resolveClassGroupId(groupId);
  const res = db.prepare(`
    UPDATE assignments SET is_completed = 1 
    WHERE group_id = ? AND id = ?
  `).run(groupId, id);

  if (res.changes === 0) {
    return `⚠️ Tugas dengan ID \`\`\`${id}\`\`\` tidak ditemukan.`;
  }
  return `✅ Tugas dengan ID \`\`\`${id}\`\`\` berhasil ditandai sebagai *SELESAI*.`;
}

/**
 * Menghapus rekaman tugas (/pr del [id])
 */
export function deleteAssignment(groupId, id) {
  groupId = resolveClassGroupId(groupId);
  const res = db.prepare(`
    DELETE FROM assignments 
    WHERE group_id = ? AND id = ?
  `).run(groupId, id);

  if (res.changes === 0) {
    return `⚠️ Tugas dengan ID \`\`\`${id}\`\`\` tidak ditemukan.`;
  }
  return `🗑️ Tugas dengan ID \`\`\`${id}\`\`\` berhasil dihapus.`;
}

/**
 * Setup Cron Pengingat PR setiap pukul 19.00 WIB
 * Mengirim pesan ke grup untuk tugas yang deadline <= 24 jam
 */
export function setupAssignmentCron(sock) {
  // Cron format: '0 19 * * *' (Pukul 19.00 setiap hari di timezone Asia/Jakarta)
  cron.schedule('0 19 * * *', async () => {
    console.log('[CRON] Menjalankan pengecekan pengingat PR pukul 19.00 WIB...');

    const classes = db.prepare('SELECT group_id, class_name FROM classes').all();

    for (const c of classes) {
      // Cari PR aktif yang deadline dalam kurun waktu 24 jam ke depan
      const urgentAssignments = db.prepare(`
        SELECT * FROM assignments 
        WHERE group_id = ? AND is_completed = 0 
          AND deadline BETWEEN datetime('now', 'localtime') AND datetime('now', 'localtime', '+24 hours')
        ORDER BY deadline ASC
      `).all(c.group_id);

      if (urgentAssignments.length > 0) {
        let msg = `⚠️ *PENGINGAT DEADLINE TUGAS (<= 24 JAM)* ⚠️\n`;
        msg += `Kelas: *${c.class_name}*\n────────────────────────────\n\n`;

        urgentAssignments.forEach(a => {
          msg += `📌 *${a.subject}*\n`;
          msg += `⏰ *Batas Waktu:* \`\`\`${a.deadline}\`\`\`\n`;
          msg += `📝 *Deskripsi:* ${a.description}\n\n`;
        });

        msg += `Segera selesaikan tugas sebelum batas waktu! 💪`;

        const targetGroups = [c.group_id, ...getLinkedGroups(c.group_id)];
        for (const targetJid of targetGroups) {
          try {
            await sock.sendMessage(targetJid, { text: msg });
          } catch (err) {
            console.error(`Gagal mengirim pengingat PR ke grup ${targetJid}:`, err.message);
          }
        }
      }
    }
  }, {
    timezone: process.env.TIMEZONE || 'Asia/Jakarta'
  });

  console.log('[CRON] Scheduler pengingat PR pukul 19.00 WIB aktif.');
}
