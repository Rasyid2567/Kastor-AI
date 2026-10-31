import { db, resolveClassGroupId } from '../../database/schema.js';
import { resolveLidToPhone, resolvePhoneToLid } from './assignments.js';

/**
 * Memeriksa apakah pengirim adalah Admin di Grup WhatsApp (admin atau superadmin)
 * Mendukung pencocokan Phone JID, LID, suffix device, dan resolusi reverse mapping.
 */
export function isWhatsAppAdmin(groupMetadata, senderJid) {
  if (!groupMetadata || !Array.isArray(groupMetadata.participants) || !senderJid) {
    return false;
  }

  const cleanSender = senderJid.replace(/:.*@/, '@').trim();
  const senderDigits = senderJid.replace(/[^0-9]/g, '');

  let senderResolvedPhone = null;
  let senderResolvedLid = null;
  if (cleanSender.endsWith('@lid')) {
    senderResolvedPhone = resolveLidToPhone(cleanSender);
  } else {
    senderResolvedLid = resolvePhoneToLid(cleanSender);
  }

  return groupMetadata.participants.some(p => {
    if (p.admin !== 'admin' && p.admin !== 'superadmin') {
      return false;
    }

    const pIdClean = (p.id || '').replace(/:.*@/, '@').trim();
    const pLidClean = (p.lid || '').replace(/:.*@/, '@').trim();
    const pIdDigits = (p.id || '').replace(/[^0-9]/g, '');
    const pLidDigits = (p.lid || '').replace(/[^0-9]/g, '');

    // 1. Pencocokan langsung JID atau LID (lengkap maupun tanpa device suffix)
    if (p.id === senderJid || pIdClean === cleanSender) return true;
    if (p.lid === senderJid || pLidClean === cleanSender) return true;

    // 2. Pencocokan digit murni nomor / LID
    if (senderDigits && (pIdDigits === senderDigits || pLidDigits === senderDigits)) {
      return true;
    }

    // 3. Pencocokan via resolusi LID <-> Phone pengirim
    if (senderResolvedPhone) {
      const cleanPhoneDigits = senderResolvedPhone.replace(/[^0-9]/g, '');
      if (pIdDigits === cleanPhoneDigits || pLidDigits === cleanPhoneDigits) return true;
    }
    if (senderResolvedLid) {
      const cleanLidDigits = senderResolvedLid.replace(/[^0-9]/g, '');
      if (pIdDigits === cleanLidDigits || pLidDigits === cleanLidDigits) return true;
    }

    // 4. Pencocokan via resolusi LID peserta grup
    if (pIdClean.endsWith('@lid')) {
      const pPhone = resolveLidToPhone(pIdClean);
      if (pPhone && (pPhone.replace(/[^0-9]/g, '') === senderDigits || pPhone === cleanSender)) {
        return true;
      }
    }
    if (pLidClean.endsWith('@lid')) {
      const pPhone = resolveLidToPhone(pLidClean);
      if (pPhone && (pPhone.replace(/[^0-9]/g, '') === senderDigits || pPhone === cleanSender)) {
        return true;
      }
    }

    return false;
  });
}

/**
 * /tagall [pesan]
 * Mention seluruh anggota grup secara terbuka
 */
export async function handleTagAll(sock, groupId, groupMetadata, customMessage = '') {
  const participants = groupMetadata.participants || [];
  const mentions = participants.map(p => p.id.replace(/:.*@/, '@'));

  let text = `📢 *PENGUMUMAN MASSAL (TAG ALL)* 📢\n`;
  if (customMessage) {
    text += `\n💬 *Pesan:* ${customMessage}\n`;
  }
  text += `────────────────────────────\n`;

  participants.forEach((p, idx) => {
    const num = p.id.split('@')[0].split(':')[0];
    text += `${idx + 1}. @${num}\n`;
  });

  await sock.sendMessage(groupId, { text, mentions });
}

/**
 * /hidetag [pesan]
 * Mengirim pesan dengan ghost mention ke seluruh anggota grup
 */
export async function handleHideTag(sock, groupId, groupMetadata, customMessage = '') {
  const participants = groupMetadata.participants || [];
  const mentions = participants.map(p => p.id.replace(/:.*@/, '@'));

  const text = customMessage || '📢 Perhatian untuk seluruh anggota kelas!';

  await sock.sendMessage(groupId, { text, mentions });
}

/**
 * Mendapatkan bobot urutan jabatan struktur kelas
 * Urutan baku:
 * 1. KETUA
 * 2. WAKIL KETUA
 * 3. SEKRETARIS (Sekretaris 1, 2, dst)
 * 4. BENDAHARA (Bendahara 1, 2, dst)
 * 5. Jabatan lainnya
 */
function getPositionWeight(positionName) {
  const norm = (positionName || '').toUpperCase().trim();
  
  if (norm === 'KETUA' || norm === 'KETUA KELAS') return 10;
  if (norm.includes('WAKIL')) return 20;
  if (norm.includes('SEKRETARIS') || norm.includes('SEKERTARIS')) {
    const numMatch = norm.match(/\d+/);
    const num = numMatch ? parseInt(numMatch[0], 10) : 1;
    return 30 + num;
  }
  if (norm.includes('BENDAHARA')) {
    const numMatch = norm.match(/\d+/);
    const num = numMatch ? parseInt(numMatch[0], 10) : 1;
    return 50 + num;
  }
  return 100;
}

/**
 * /struktur
 * Menampilkan bagan struktur kelas
 */
export function getOrganizationStructure(groupId) {
  groupId = resolveClassGroupId(groupId);
  const classInfo = db.prepare('SELECT class_name FROM classes WHERE group_id = ?').get(groupId);
  if (!classInfo) return { text: '⚠️ Kelas belum terdaftar di sistem bot.', mentions: [] };

  const structures = db.prepare(`
    SELECT position_name, holder_name, phone_number 
    FROM organization_structures 
    WHERE group_id = ?
    ORDER BY id ASC
  `).all(groupId);

  const mentions = [];

  if (structures.length === 0) {
    // Default struktur dari roles jika belum ada di organization_structures
    const roles = db.prepare(`
      SELECT role, phone_number 
      FROM class_roles 
      WHERE group_id = ?
    `).all(groupId);

    if (roles.length === 0) {
      return { 
        text: `ℹ️ Belum ada struktur pengurus kelas yang didaftarkan. Gunakan \`/struktur set [jabatan] [nama] [tag]\` untuk mengatur.`,
        mentions: []
      };
    }

    // Urutkan roles sesuai hierarki baku: KETUA -> SEKRETARIS -> BENDAHARA
    roles.sort((a, b) => getPositionWeight(a.role) - getPositionWeight(b.role));

    let text = `🏛️ *STRUKTUR KELAS ${classInfo.class_name.toUpperCase()}*\n`;
    text += `────────────────────────────\n\n`;
    roles.forEach(r => {
      const cleanNum = r.phone_number.split('@')[0].split(':')[0];
      text += `• *${r.role}:* @${cleanNum}\n`;
      mentions.push(r.phone_number.includes('@') ? r.phone_number : `${cleanNum}@s.whatsapp.net`);
    });
    return { text, mentions };
  }

  // Urutkan struktur pengurus: KETUA -> WAKIL -> SEKRETARIS -> BENDAHARA -> Lainnya
  structures.sort((a, b) => {
    const weightDiff = getPositionWeight(a.position_name) - getPositionWeight(b.position_name);
    if (weightDiff !== 0) return weightDiff;
    return a.position_name.localeCompare(b.position_name);
  });

  let text = `🏛️ *STRUKTUR KELAS ${classInfo.class_name.toUpperCase()}*\n`;
  text += `────────────────────────────\n\n`;
  structures.forEach(s => {
    let line = `• *${s.position_name.toUpperCase()}:* ${s.holder_name}`;
    if (s.phone_number) {
      const cleanNum = s.phone_number.split('@')[0].split(':')[0];
      line += ` (@${cleanNum})`;
      mentions.push(s.phone_number.includes('@') ? s.phone_number : `${cleanNum}@s.whatsapp.net`);
    }
    text += `${line}\n`;
  });

  return { text, mentions };
}

/**
 * /struktur set [jabatan] [nama] [tag nomor]
 */
export function setOrganizationPosition(groupId, argsText, mentionedJids = []) {
  groupId = resolveClassGroupId(groupId);
  if (!argsText) {
    return {
      text: `⚠️ Format salah!\nGunakan: \`/struktur set [jabatan] [nama] [tag/nomor]\`\nContoh:\n• \`/struktur set Ketua Raka @6285746616454\`\n• \`/struktur set "Bendahara 1" Naswa @6281234567890\``
    };
  }

  const trimmed = argsText.trim();
  let position = '';
  let rest = '';

  // 1. Cek apakah jabatan diapit tanda kutip ganda "" (contoh: "Bendahara 1" Naswa @...)
  const quoteMatch = trimmed.match(/^"([^"]+)"\s*(.*)$/);
  if (quoteMatch) {
    position = quoteMatch[1].trim();
    rest = quoteMatch[2].trim();
  } else {
    // 2. Dukung jabatan umum yang mengandung spasi tanpa tanda petik (contoh: bendahara 1, sekretaris 2, wakil ketua)
    const multiMatch = trimmed.match(/^(bendahara\s+\d+|sekretaris\s+\d+|sekertaris\s+\d+|wakil\s+ketua)\s+(.*)$/i);
    if (multiMatch) {
      position = multiMatch[1].trim();
      rest = multiMatch[2].trim();
    } else {
      const parts = trimmed.split(/\s+/);
      position = parts[0];
      rest = parts.slice(1).join(' ');
    }
  }

  if (!position) {
    return {
      text: `⚠️ Format salah!\nGunakan: \`/struktur set [jabatan] [nama] [tag/nomor]\`\nContoh: \`/struktur set "Sekretaris 2" Citra @628987654321\``
    };
  }

  // Deteksi target phone number / JID dari mentionedJids atau dari teks tag di akhir/bagian teks
  let targetPhone = null;
  if (mentionedJids && mentionedJids.length > 0) {
    targetPhone = mentionedJids[0].replace(/:.*@/, '@');
  }

  // Cek apakah ada nomor telp / tag di dalam teks (misal @628... atau 08... atau 628...)
  const tagMatch = rest.match(/@?((?:0|62)\d{8,15})(?:@s\.whatsapp\.net)?/);
  if (!targetPhone && tagMatch) {
    let num = tagMatch[1];
    if (num.startsWith('0')) num = '62' + num.slice(1);
    targetPhone = `${num}@s.whatsapp.net`;
  }

  // Bersihkan teks nama dari tag jika ada
  let holderName = rest;
  if (tagMatch) {
    holderName = rest.replace(tagMatch[0], '').trim();
  } else if (targetPhone) {
    const rawNum = targetPhone.split('@')[0];
    holderName = rest.replace(new RegExp(`@?${rawNum}`), '').trim();
  }

  // Jika holderName kosong (hanya mengetik jabatan dan tag), beri fallback nama
  if (!holderName) {
    holderName = targetPhone ? `@${targetPhone.split('@')[0]}` : 'Pengurus';
  }

  const normPosition = position.toUpperCase().trim();

  // Hapus entri sebelumnya dengan jabatan yang sama persis
  db.prepare(`
    DELETE FROM organization_structures 
    WHERE group_id = ? AND UPPER(position_name) = ?
  `).run(groupId, normPosition);

  // Simpan ke organization_structures
  db.prepare(`
    INSERT INTO organization_structures (group_id, position_name, holder_name, phone_number)
    VALUES (?, ?, ?, ?)
  `).run(groupId, normPosition, holderName, targetPhone);

  // Pemetaan jabatan ke hak akses resmi class_roles:
  // "BENDAHARA 1" / "BENDAHARA 2" -> 'BENDAHARA'
  // "SEKRETARIS 1" / "SEKRETARIS 2" -> 'SEKRETARIS'
  // "WAKIL KETUA" / "KETUA" -> 'KETUA'
  let matchedRole = null;
  if (normPosition.includes('BENDAHARA')) {
    matchedRole = 'BENDAHARA';
  } else if (normPosition.includes('SEKRETARIS') || normPosition.includes('SEKERTARIS')) {
    matchedRole = 'SEKRETARIS';
  } else if (normPosition.includes('KETUA')) {
    matchedRole = 'KETUA';
  }

  if (targetPhone && matchedRole) {
    db.prepare(`
      INSERT OR REPLACE INTO class_roles (group_id, phone_number, role)
      VALUES (?, ?, ?)
    `).run(groupId, targetPhone, matchedRole);
  }

  const cleanNum = targetPhone ? targetPhone.split('@')[0] : null;
  let confirmText = `✅ Jabatan *${normPosition}* berhasil diatur ke *${holderName}*`;
  if (cleanNum) {
    confirmText += ` (@${cleanNum})`;
  }
  confirmText += `.`;

  return {
    text: confirmText,
    mentions: targetPhone ? [targetPhone] : []
  };
}

/**
 * /struktur del [jabatan]
 */
export function deleteOrganizationPosition(groupId, position) {
  groupId = resolveClassGroupId(groupId);
  if (!position) {
    return '⚠️ Format salah!\nGunakan: `/struktur del [jabatan]`\nContoh: `/struktur del Ketua`';
  }

  const normPosition = position.toUpperCase().trim();
  const info = db.prepare(`
    DELETE FROM organization_structures 
    WHERE group_id = ? AND UPPER(position_name) = ?
  `).run(groupId, normPosition);

  if (info.changes === 0) {
    return `ℹ️ Jabatan *${normPosition}* tidak ditemukan di struktur kelas ini.`;
  }

  return `🗑️ Jabatan *${normPosition}* berhasil dihapus dari struktur organisasi.`;
}

/**
 * /remind [waktu_menit] [pesan]
 */
export function handleRemind(sock, groupId, argsText) {
  const [minutesStr, ...msgParts] = argsText.split(' ');
  const minutes = parseInt(minutesStr, 10);
  const message = msgParts.join(' ').trim();

  if (isNaN(minutes) || minutes <= 0 || !message) {
    return '⚠️ Format salah!\nGunakan: `/remind [menit] [pesan]`\nContoh: `/remind 30 Istirahat selesai kumpul di lab`';
  }

  const ms = minutes * 60 * 1000;
  setTimeout(async () => {
    try {
      await sock.sendMessage(groupId, {
        text: `⏰ *PENGINGAT KELAS (${minutes} MENIT TELAH BERLALU)*\n\n📢 ${message}`
      });
    } catch (e) {
      console.error('Gagal mengirim pesan pengingat:', e.message);
    }
  }, ms);

  return `✅ Pengingat telah disetel untuk *${minutes} menit* ke depan.`;
}
